import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Search,
  X,
  BookOpen,
  ChevronDown,
  WifiOff,
} from "lucide-react";
import { analyze } from "./lookup";
import LaneEntry from './LaneEntry';
import { isNative, nativeCall } from './platform';
import { findEntries, installedPacks } from "./storage";
import {
  arabicWord,
  cleanWord,
  featureLabel,
  patternLabel,
  verbForm,
} from "./arabic";
import type {
  Analysis,
  AnalysisResult,
  DictionaryEntry,
  Lookup,
} from "./types";

export function ArabicLinks({
  text,
  onLookup,
}: {
  text: string;
  onLookup: (word: string) => void;
}) {
  const parts: React.ReactNode[] = [];
  let index = 0;
  for (const match of text.matchAll(new RegExp(arabicWord.source, "g"))) {
    parts.push(text.slice(index, match.index));
    parts.push(
      <button
        className="inline-arabic"
        lang="ar"
        dir="rtl"
        key={`${match.index}`}
        onClick={() => onLookup(match[0])}
      >
        {match[0]}
      </button>,
    );
    index = match.index + match[0].length;
  }
  parts.push(text.slice(index));
  return <>{parts}</>;
}
export default function Dictionary({
  initial,
  onClose,
  onSettings,
}: {
  initial: Lookup;
  onClose: () => void;
  onSettings: () => void;
}) {
  const [history, setHistory] = useState<Lookup[]>([initial]);
  const [position, setPosition] = useState(0);
  const [query, setQuery] = useState(initial.word);
  const [response, setResponse] = useState<AnalysisResult | null>(null);
  const [candidate, setCandidate] = useState<Analysis | null>(null);
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [cached, setCached] = useState(false);
  const [error, setError] = useState("");
  const [packCount, setPackCount] = useState(0);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const changed = () => setRevision((n) => n + 1);
    window.addEventListener("waraq-dictionaries", changed);
    return () => window.removeEventListener("waraq-dictionaries", changed);
  }, []);
  const current = history[position];
  const initialRef = useRef(initial);
  const navigate = (lookup: Lookup) => {
    setHistory((h) => [...h.slice(0, position + 1), lookup]);
    setPosition(position + 1);
    setQuery(lookup.word);
  };
  useEffect(() => {
    if (initialRef.current !== initial) {
      initialRef.current = initial;
      setHistory([initial]);
      setPosition(0);
      setQuery(initial.word);
    }
  }, [initial]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setResponse(null);
    setCandidate(null);
    setEntries([]);
    setError("");
    setCached(false);
    setBusy(true);
    setQuery(current.word);
    installedPacks().then((p) => {
      if (active) setPackCount(p.length);
    });
    (async () => {
      const direct = await findEntries(current.word, current.kind === "root");
      if (!active) return;
      setEntries(direct);
      if (current.kind === "root") {
        setBusy(false);
        return;
      }
      try {
        const { result, cached } = await analyze(
          current.word,
          controller.signal,
        );
        if (!active) return;
        setResponse(result);
        setCached(cached);
        setCandidate(result.analyses[0] || null);
      } catch (e) {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "Could not reach the analysis service.",
          );
      } finally {
        if (active) setBusy(false);
      }
    })().catch((e) => {
      if (active) {
        setError(String(e));
        setBusy(false);
      }
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [current, revision]);
  useEffect(() => {
    if (!candidate) return;
    let active = true;
    Promise.all([findEntries(current.word), findEntries(candidate.lemma)]).then(
      (groups) => {
        if (active)
          setEntries([
            ...new Map(groups.flat().map((e) => [e.id, e])).values(),
          ]);
      },
    );
    return () => {
      active = false;
    };
  }, [candidate, current]);
  const go = (word: string) => navigate({ word, kind: "word" });
  const groups = entries.reduce(
    (acc, entry) => {
      (acc[entry.source] ??= []).push(entry);
      return acc;
    },
    {} as Record<string, DictionaryEntry[]>,
  );
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const word = cleanWord(query);
    if (word)
      navigate({
        word,
        kind: /^[\u0621-\u064aٱ](?:[ .]+[\u0621-\u064aٱ]){2,3}$/.test(word)
          ? "root"
          : "word",
      });
  }
  return (
    <aside className="dictionary" aria-label="Word explorer">
      <header className="panel-header">
        <span>
          <BookOpen size={17} /> Word explorer
        </span>
        <div className="button-row">
          <button
            className="icon-button"
            aria-label="Previous lookup"
            disabled={position === 0}
            onClick={() => setPosition((p) => p - 1)}
          >
            <ArrowLeft size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Next lookup"
            disabled={position === history.length - 1}
            onClick={() => setPosition((p) => p + 1)}
          >
            <ArrowRight size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Close dictionary"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
      </header>
      <form className="dictionary-search" onSubmit={submit}>
        <Search size={17} />
        <input
          aria-label="Search Arabic word or root"
          placeholder="A word or root…"
          dir="auto"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button aria-label="Look up word" type="submit">
          <ArrowRight size={18} />
        </button>
      </form>
      <div className="dictionary-body" aria-live="polite">
        <span className="eyebrow">
          {current.kind === "root" ? "Root family" : "Selected word"}
        </span>
        <h2 className="lookup-word" dir="rtl" lang="ar">
          {candidate?.diac || current.word}
        </h2>
        {busy && <p className="subtle pulse">Looking up this word…</p>}
        {candidate && (
          <>
            <p className="quick-gloss">
              {candidate.gloss.replace(/\[[^\]]*\]/g, "").replace(/\+/g, " · ")}
            </p>
            <span className="source-caption">
              CAMeL Morph · {cached ? "saved analysis" : "on-device analysis"}
            </span>
            {response && response.analyses.length > 1 && (
              <label className="reading-select">
                Possible readings{" "}
                <span className="subtle">
                  ({response.total}
                  {response.truncated ? " · first 80 shown" : ""})
                </span>
                <select
                  aria-label="Possible readings"
                  value={candidate.id}
                  onChange={(e) =>
                    setCandidate(
                      response.analyses.find((a) => a.id === e.target.value)!,
                    )
                  }
                >
                  {response.analyses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.diac} —{" "}
                      {["pos", "vox", "mod", "cas", "stt"]
                        .filter((k) => a.features[k])
                        .map((k) => featureLabel(k, a.features[k]))
                        .join(" · ")}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="small-note">
              Possible analysis, not a contextual translation. The surrounding
              sentence may change the reading.
            </p>
            <section className="word-facts">
              <div>
                <span className="eyebrow">Dictionary form</span>
                <button
                  className="arabic-link"
                  lang="ar"
                  dir="rtl"
                  onClick={() => go(candidate.lemma)}
                >
                  {candidate.lemma}
                </button>
              </div>
              {candidate.root && (
                <div>
                  <span className="eyebrow">Root</span>
                  <button
                    className="arabic-link"
                    lang="ar"
                    dir="rtl"
                    onClick={() =>
                      navigate({ word: candidate.root, kind: "root" })
                    }
                  >
                    {candidate.root}
                  </button>
                </div>
              )}
            </section>
            <details className="grammar" open>
              <summary>
                Grammar <ChevronDown size={15} />
              </summary>
              {candidate.pattern && (
                <div className="grammar-row">
                  <span>
                    Pattern
                    {candidate.features.pos === "verb" &&
                    verbForm(candidate.pattern)
                      ? ` · ${verbForm(candidate.pattern)}`
                      : ""}
                  </span>
                  <bdi lang="ar">{patternLabel(candidate.pattern)}</bdi>
                </div>
              )}
              {Object.entries(candidate.features).map(([key, value]) => (
                <div className="grammar-row" key={key}>
                  <span>
                    {{
                      pos: "Part of speech",
                      asp: "Aspect",
                      vox: "Voice",
                      per: "Person",
                      gen: "Gender",
                      num: "Number",
                      cas: "Case",
                      mod: "Mood",
                      stt: "State",
                      prc0: "Article",
                      prc1: "Prefix",
                      prc2: "Conjunction",
                      prc3: "Question prefix",
                      enc0: "Pronoun suffix",
                    }[key] || key}
                  </span>
                  <span>{featureLabel(key, value)}</span>
                </div>
              ))}
            </details>
          </>
        )}
        {error && (
          <p className="notice">
            <WifiOff size={16} />
            <span>
              {error} Downloaded definitions are still available.
            </span>
          </p>
        )}
        {!busy && response?.analyses.length === 0 && (
          <p className="small-note">
            No matching analysis. Try the dictionary form or a root. Existing
            vowel marks are respected.
          </p>
        )}
        {current.kind === "root" && (
          <p className="small-note">
            Related entries from your downloaded dictionaries. A root can have
            several families of meaning.
          </p>
        )}
        {!packCount && (
          <div className="dictionary-empty">
            <BookOpen size={25} />
            <p>Bring your dictionaries along.</p>
            <span>
              Download Kaikki and Lane’s for definitions that work offline.
            </span>
            <button className="secondary-button" onClick={onSettings}>
              Dictionary downloads
            </button>
          </div>
        )}
        {Object.entries(groups).map(([source, records]) => (
          <section className="definition-source" key={source}>
            <h3>
              {source === "kaikki" ? "Wiktionary · Kaikki" : "Lane’s Lexicon"}
              <span>{source === "lane" ? "CLASSICAL" : "DICTIONARY"}</span>
            </h3>
            {records
              .slice(0, current.kind === "root" ? 80 : 24)
              .map((entry) => (
                <details
                  className="definition-entry"
                  key={entry.id}
                  open={records.length <= 3}
                >
                  <summary>
                    <span lang="ar" dir="rtl">
                      {entry.word}
                    </span>
                    <span className="subtle">{entry.pos || "Entry"}</span>
                    <ChevronDown size={14} />
                  </summary>
                  <div className="definition-text">
                    {source === 'lane' ? <LaneEntry entry={entry} onLookup={go}/> : entry.senses.map((sense, i) => (
                      <p key={i}>
                        <ArabicLinks text={sense} onLookup={go} />
                      </p>
                    ))}
                    {entry.formOf.length > 0 && (
                      <p>
                        See{" "}
                        {entry.formOf.map((word) => (
                          <button
                            className="inline-arabic"
                            key={word}
                            dir="rtl"
                            lang="ar"
                            onClick={() => go(word)}
                          >
                            {word}
                          </button>
                        ))}
                      </p>
                    )}
                    <a href={entry.url} target="_blank" rel="noreferrer">
                      Source{entry.page ? ` · page ${entry.page}` : ""} ↗
                    </a>
                  </div>
                </details>
              ))}
            {records.length > (current.kind === "root" ? 80 : 24) && (
              <p className="small-note">
                More entries exist. Search a specific dictionary form to narrow
                the results.
              </p>
            )}
          </section>
        ))}
        {packCount > 0 && !busy && entries.length === 0 && (
          <p className="small-note">
            No entry in your downloaded dictionaries. Try a lemma or another
            spelling.
          </p>
        )}
        {isNative && <button className="secondary-button" onClick={()=>void nativeCall('referenceOpen',{root:candidate?.root || (current.kind==='root'?current.word:'')}).catch(e=>setError(String(e)))}>Open personal dictionary PDF</button>}
      </div>
    </aside>
  );
}
