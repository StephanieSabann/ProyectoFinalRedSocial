/**
 * Almacenamiento de imágenes.
 *
 * - ALMACENAMIENTO=s3    -> Amazon S3 (producción en AWS). Las fotos se guardan en el bucket S3_BUCKET.
 * - ALMACENAMIENTO=azure -> Azure Blob Storage (producción en Azure, equivalente a S3).
 *                           Las fotos se guardan en el contenedor AZURE_CONTENEDOR.
 * - ALMACENAMIENTO=local -> carpeta imagenes/ del proyecto (solo para desarrollo).
 *
 * En la base de datos solo se guarda la "key" (ruta dentro del bucket), nunca la imagen.
 * Estructura de keys:
 *   usuarios/{usuarioId}/publicaciones/{uuid}/original.jpg | mediana.webp | miniatura.webp | bn.jpg | sepia.jpg | escala.jpg
 *   usuarios/{usuarioId}/avatar/{uuid}.webp
 *   usuarios/{usuarioId}/historias/{uuid}.jpg
 *
 * URLs: el bucket / contenedor es PRIVADO. Se entregan URLs firmadas (S3: presigned URL,
 * Azure: token SAS de solo lectura) que duran 1 hora y
 * se reutilizan desde una caché en memoria para que el navegador pueda cachear las imágenes.
 * Si existe S3_URL_PUBLICA (por ejemplo, un dominio de CloudFront) se usa esa base.
 */
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const DRIVER = ['s3', 'azure'].includes(process.env.ALMACENAMIENTO) ? process.env.ALMACENAMIENTO : 'local';
const CARPETA_LOCAL = path.join(__dirname, '..', 'imagenes');
const DURACION_URL = 60 * 60;          // 1 hora (segundos)
const RENOVAR_ANTES = 10 * 60 * 1000;  // renueva la URL si le quedan menos de 10 min

let s3 = null;
let comandos = null;
let firmar = null;

// El SDK de AWS solo se carga si se usa S3
if (DRIVER === 's3') {
  const sdk = require('@aws-sdk/client-s3');
  comandos = sdk;
  firmar = require('@aws-sdk/s3-request-presigner').getSignedUrl;
  s3 = new sdk.S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    // S3_ENDPOINT solo se usa para pruebas con un emulador de S3
    ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {})
  });
}

const BUCKET = process.env.S3_BUCKET;

// El SDK de Azure solo se carga si se usa Azure Blob Storage
let contenedor = null;
let azure = null;
if (DRIVER === 'azure') {
  azure = require('@azure/storage-blob');
  const servicio = azure.BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING || '');
  contenedor = servicio.getContainerClient(process.env.AZURE_CONTENEDOR || 'fotos');
}

/** Genera un identificador único para una carpeta o archivo nuevo. */
const nuevoId = () => randomUUID();

/** Sube (o escribe) un archivo. */
async function guardar(key, buffer, tipo) {
  if (DRIVER === 's3') {
    await s3.send(new comandos.PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: tipo,
      // Las keys nunca se reutilizan (llevan un UUID), así que se pueden cachear "para siempre"
      CacheControl: 'private, max-age=31536000, immutable'
    }));
    return key;
  }
  if (DRIVER === 'azure') {
    await contenedor.getBlockBlobClient(key).uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: tipo, blobCacheControl: 'private, max-age=31536000, immutable' }
    });
    return key;
  }
  const destino = path.join(CARPETA_LOCAL, key);
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, buffer);
  return key;
}

// Caché de URLs firmadas: key -> { url, vence }
const cacheUrls = new Map();

/** Devuelve la URL para mostrar una imagen en el navegador. */
async function url(key) {
  if (!key) return null;
  if (DRIVER === 'local') return `/imagenes/${key}`;
  if (process.env.S3_URL_PUBLICA) return `${process.env.S3_URL_PUBLICA.replace(/\/$/, '')}/${key}`;

  const guardada = cacheUrls.get(key);
  if (guardada && guardada.vence - Date.now() > RENOVAR_ANTES) return guardada.url;

  const firmada = DRIVER === 'azure'
    // Token SAS de solo lectura (permiso "r") que vence en 1 hora
    ? await contenedor.getBlobClient(key).generateSasUrl({
      permissions: azure.BlobSASPermissions.parse('r'),
      expiresOn: new Date(Date.now() + DURACION_URL * 1000)
    })
    : await firmar(s3, new comandos.GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: DURACION_URL });
  cacheUrls.set(key, { url: firmada, vence: Date.now() + DURACION_URL * 1000 });
  if (cacheUrls.size > 20000) cacheUrls.clear(); // evita que la caché crezca sin límite
  return firmada;
}

/** Borra uno o varios archivos (no falla si no existen). */
async function borrar(keys) {
  const lista = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
  if (lista.length === 0) return;
  lista.forEach((k) => cacheUrls.delete(k));
  try {
    if (DRIVER === 's3') {
      for (let i = 0; i < lista.length; i += 1000) {
        await s3.send(new comandos.DeleteObjectsCommand({
          Bucket: BUCKET,
          Delete: { Objects: lista.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true }
        }));
      }
      return;
    }
    if (DRIVER === 'azure') {
      await Promise.all(lista.map((k) => contenedor.deleteBlob(k, { deleteSnapshots: 'include' }).catch((e) => {
        if (e.statusCode !== 404) throw e;
      })));
      return;
    }
    await Promise.all(lista.map((k) => fs.unlink(path.join(CARPETA_LOCAL, k)).catch(() => {})));
  } catch (error) {
    console.error('No se pudieron borrar archivos:', error.message);
  }
}

/** En Azure crea el contenedor (privado) si todavía no existe. */
async function preparar() {
  if (DRIVER !== 'azure') return;
  try {
    await contenedor.createIfNotExists();
    console.log(`Almacenamiento: Azure Blob Storage, contenedor "${contenedor.containerName}"`);
  } catch (error) {
    console.error('No se pudo conectar a Azure Blob Storage. Revisa AZURE_STORAGE_CONNECTION_STRING:', error.message);
  }
}

module.exports = { preparar, DRIVER, BUCKET, CARPETA_LOCAL, nuevoId, guardar, url, borrar };
