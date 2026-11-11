import { useRef, useState } from 'react';
import { decodeFile, ImportError, parseIdeasCsv } from '../domain/csv';
import type { Action } from '../state/store';

const MAX_SIZE = 5 * 1024 * 1024;

export function ImportScreen({ dispatch, clientName }: { dispatch: (a: Action) => void; clientName: string }) {
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function handle(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setError("Ce fichier n'est pas un export CSV. Dans Excel : Fichier › Enregistrer sous › CSV (séparateur point-virgule).");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('Ce fichier est trop volumineux (5 Mo maximum).');
      return;
    }
    setLoading(true);
    try {
      const { ideas, warnings } = parseIdeasCsv(decodeFile(await file.arrayBuffer()));
      dispatch({ type: 'import', fichier: file.name, ideas, warnings });
    } catch (e) {
      setError(e instanceof ImportError ? e.message : "Le fichier n'a pas pu être lu. Vérifiez qu'il s'agit bien de l'export du formulaire.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: '24px auto' }}>
      <h2>Préparer le jury du challenge {clientName}</h2>
      <p className="muted lead" style={{ margin: '6px 0 20px' }}>
        Importez l'export du formulaire : l'outil rassemble les idées, propose une première note sur la grille du client,
        repère les doublons et prépare la shortlist à envoyer.
      </p>

      {error && (
        <div className="banner banner-error" role="alert">
          <span aria-hidden>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div
        className={`dropzone ${over ? 'over' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handle(e.dataTransfer.files[0]);
        }}
      >
        <div className="dropzone-icon" aria-hidden>📄</div>
        <h3>{loading ? 'Lecture du fichier…' : "Déposez ici l'export des idées"}</h3>
        <p className="muted small" style={{ margin: '6px 0 14px' }}>Fichier .csv, tel qu'exporté depuis le formulaire</p>
        <button className="btn btn-primary" type="button" disabled={loading} onClick={(e) => { e.stopPropagation(); input.current?.click(); }}>
          Choisir un fichier
        </button>
        <input ref={input} type="file" accept=".csv,text/csv,.txt" hidden onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      <p className="tiny" style={{ marginTop: 10, textAlign: 'center' }}>
        🔒 Le fichier reste sur cet ordinateur : il est lu par votre navigateur et n'est envoyé nulle part.
      </p>

      <div className="steps">
        {[
          ['Relire et noter', "Chaque idée reçoit une note proposée et sa justification. Vous corrigez d'un clic."],
          ['Écarter les doublons', 'Les idées proches sont présentées côte à côte. Vous décidez.'],
          ['Envoyer la shortlist', 'Les 8 meilleures idées, prêtes à imprimer en PDF ou à ouvrir dans Excel.'],
        ].map(([t, d], i) => (
          <div className="card step" key={t}>
            <div className="step-num">{i + 1}</div>
            <h3>{t}</h3>
            <p className="muted small" style={{ marginTop: 4 }}>{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
