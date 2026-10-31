/**
 * Explorar: cuadrícula de MINIATURAS de todas las publicaciones (24 por página),
 * con celdas altas intercaladas. En celular tiene un buscador arriba.
 */
import { useEffect, useState } from 'react';
import { Celda } from '../componentes/Publicacion';
import { FilaPersona } from '../componentes/Basicos';
import { useBusqueda } from '../componentes/Paneles';
import { useInterfaz } from '../contexto/Interfaz';
import { usePaginado } from './Inicio';

export default function Explorar() {
  const { refrescos } = useInterfaz();
  const { ids, estado, centinela } = usePaginado('/publicaciones', refrescos.feed);
  const [texto, setTexto] = useState('');
  const resultados = useBusqueda(texto);
  useEffect(() => { document.title = 'Explorar'; }, []);

  return (
    <section id="vista-explorar" className="vista">
      <div className="buscador buscador-explorar">
        <input type="search" placeholder="Buscar" autoComplete="off" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      {texto.trim() ? (
        <div className="lista-personas">
          {resultados === null && <div className="cargando-mas activo" />}
          {resultados?.length === 0 && <p className="vacio">No se encontraron resultados.</p>}
          {resultados?.map((p) => <FilaPersona key={p.id} persona={p} boton={false} />)}
        </div>
      ) : (
        <>
          <div className="cuadricula cuadricula-explorar">
            {estado.total === 0 && (
              <div className="perfil-vacio"><h3>Todavía no hay publicaciones</h3><p>Sé la primera persona en compartir una foto.</p></div>
            )}
            {/* En cada bloque de 10, las posiciones 3 y 6 son celdas altas */}
            {ids.map((id, i) => <Celda key={id} id={id} alta={i % 10 === 2 || i % 10 === 5} />)}
          </div>
          <div ref={centinela} className={`cargando-mas ${estado.cargando ? 'activo' : ''}`} />
        </>
      )}
    </section>
  );
}
