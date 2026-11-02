/**
 * Amazon Rekognition (opcional avanzado).
 *
 * Se activa con REKOGNITION=on y solo funciona con ALMACENAMIENTO=s3
 * (Rekognition lee la foto directamente del bucket).
 * - DetectLabels: etiquetas de lo que hay en la foto (ej. "Montaña", "Persona").
 * - DetectModerationLabels: contenido inapropiado -> la foto se marca como "sensible"
 *   y el frontend la muestra borrosa hasta que el usuario decida verla.
 */
const almacenamiento = require('./almacenamiento');

const ACTIVO = process.env.REKOGNITION === 'on' && almacenamiento.DRIVER === 's3';

let cliente = null;
let comandos = null;
if (ACTIVO) {
  comandos = require('@aws-sdk/client-rekognition');
  cliente = new comandos.RekognitionClient({ region: process.env.AWS_REGION || 'us-east-1' });
}

/**
 * Analiza una imagen guardada en S3.
 * @returns {{ etiquetas: Array<{nombre:string, confianza:number}>, sensible: boolean } | null}
 */
async function analizar(key) {
  if (!ACTIVO) return null;
  const imagen = { S3Object: { Bucket: almacenamiento.BUCKET, Name: key } };
  try {
    const [etiquetas, moderacion] = await Promise.all([
      cliente.send(new comandos.DetectLabelsCommand({ Image: imagen, MaxLabels: 8, MinConfidence: 80 })),
      cliente.send(new comandos.DetectModerationLabelsCommand({ Image: imagen, MinConfidence: 70 }))
    ]);
    return {
      etiquetas: (etiquetas.Labels || []).map((l) => ({ nombre: l.Name, confianza: Math.round(l.Confidence) })),
      sensible: (moderacion.ModerationLabels || []).length > 0
    };
  } catch (error) {
    // Si Rekognition falla, la foto se publica igual (sin etiquetas)
    console.error('Rekognition no pudo analizar la imagen:', error.message);
    return null;
  }
}

module.exports = { ACTIVO, analizar };
