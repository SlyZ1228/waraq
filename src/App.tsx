import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Plus,
  Search,
  Settings as SettingsIcon,
  ArrowUpRight,
  MoreHorizontal,
  Trash2,
  LoaderCircle,
  Pencil,
} from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { importBook } from "./books";
import { listBooks, loadSettings, saveSettings, removeBook } from "./storage";
import { themes } from "./themes";
import {
  defaultSettings,
  type BookSummary,
  type ReaderSettings,
} from "./types";
import Reader from "./Reader";
import Settings from "./Settings";
import BookEditor from './BookEditor';
import { isNative, readBytes } from './platform';

function Cover({
  book,
  large = false,
}: {
  book: BookSummary;
  large?: boolean;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!book.cover) return;
    const object = URL.createObjectURL(book.cover);
    setUrl(object);
    return () => URL.revokeObjectURL(object);
  }, [book.cover]);
  return (
    <div
      className={`book-cover ${large ? "large" : ""}`}
      style={
        {
          "--cover-hue": String((parseInt(book.id.slice(0, 2), 16) % 70) + 35),
        } as React.CSSProperties
      }
    >
      {url ? (
        <img src={url} alt="" />
      ) : (
        <div className="cover-placeholder">
          <span className="cover-ornament">ورق</span>
          <strong dir="auto">{book.title}</strong>
          <span dir="auto">{book.author}</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [books, setBooks] = useState<BookSummary[]>([]),
    [active, setActive] = useState<BookSummary | null>(null),
    [settings, setSettings] = useState<ReaderSettings>(defaultSettings);
  const [ready, setReady] = useState(false),
    [preferences, setPreferences] = useState(false),
    [query, setQuery] = useState(""),
    [importing, setImporting] = useState(false),
    [notice, setNotice] = useState(""),
    [remove, setRemove] = useState<string | null>(null);
  const [editing,setEditing]=useState<BookSummary|null>(null);
  const input = useRef<HTMLInputElement>(null);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();
  async function refresh() {
    setBooks(await listBooks());
  }
  useEffect(() => {
    Promise.all([listBooks(), loadSettings()])
      .then(([b, s]) => {
        setBooks(b);
        setSettings(s);
        setReady(true);
      })
      .catch(() =>
        setNotice(
          isNative ? "Local storage could not be opened. Reopen the project and check that the complete WaraqData folder was transferred." : "Local storage could not be opened. Use a regular Safari window and allow website storage.",
        ),
      );
  }, []);
  useEffect(() => {
    const theme = themes[settings.theme];
    for (const [key, value] of Object.entries(theme))
      document.documentElement.style.setProperty(`--${key}`, value);
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 9000);
    return () => clearTimeout(timer);
  }, [notice]);
  function changeSettings(next: ReaderSettings) {
    setSettings(next);
    void saveSettings(next).catch(() =>
      setNotice(
        "Reading preferences could not be saved. Check device storage.",
      ),
    );
  }
  async function imports(files: File[]) {
    setImporting(true);
    let count = 0;
    const errors: string[] = [];
    for (const file of files) {
      try {
        await importBook(file);
        count++;
      } catch (e) {
        errors.push(
          `${file.name}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    await refresh();
    setImporting(false);
    setNotice(
      [
        count
          ? `${count === 1 ? "Book" : `${count} books`} added to your library.`
          : "",
        ...errors,
      ]
        .filter(Boolean)
        .join(" "),
    );
    if (input.current) input.current.value = "";
  }
  async function sample() {
    try {
      await imports([
        new File([await readBytes("/sample.epub")], "a-window-to-arabic.epub", {
          type: "application/epub+zip",
        }),
      ]);
    } catch (e) {
      setNotice(String(e));
    }
  }
  const recent = books.find((b) => b.lastRead > 0),
    visible = books.filter((b) =>
      `${b.title} ${b.author}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
    );
  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".epub,application/epub+zip"
        multiple
        hidden
        onChange={(e) => void imports(Array.from(e.target.files || []))}
      />
      {active ? (
        <Reader
          book={active}
          settings={settings}
          onSettings={changeSettings}
          onExit={() => {
            setActive(null);
            void refresh();
          }}
          onDownloads={() => setPreferences(true)}
        />
      ) : (
        <div className="library-screen">
          <header className="app-header">
            <a className="brand" href="#" aria-label="Waraq library">
              <span lang="ar">ورق</span>
              <span>
                Waraq<small>A little closer to Arabic.</small>
              </span>
            </a>
            <button
              className="icon-button settings-button"
              aria-label="Library settings and downloads"
              onClick={() => setPreferences(true)}
            >
              <SettingsIcon size={22} />
            </button>
          </header>
          <main className="library-content">
            <div className="library-heading">
              <div>
                <p className="eyebrow">YOUR READING SPACE</p>
                <h1>
                  Library<span>.</span>
                </h1>
                <p className="subtle">
                  One page. One word. A little more understanding.
                </p>
              </div>
              <button
                className="primary-button"
                disabled={importing || !ready}
                onClick={() => input.current?.click()}
              >
                {importing ? (
                  <LoaderCircle size={18} className="spin" />
                ) : (
                  <Plus size={19} />
                )}{" "}
                {importing ? "Adding your books…" : "Add a book"}
              </button>
            </div>
            {recent && !query && (
              <section className="continue-card">
                <button
                  className="continue-cover"
                  onClick={() => setActive(recent)}
                  aria-label={`Continue ${recent.title}`}
                >
                  <Cover book={recent} />
                </button>
                <div>
                  <p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p>
                  <h2 dir="auto">{recent.title}</h2>
                  <p dir="auto">{recent.author}</p>
                  <div className="reading-progress">
                    <span
                      style={{
                        width: `${Math.max(1, recent.progress * 100)}%`,
                      }}
                    />
                  </div>
                  <small>
                    {Math.round(recent.progress * 100)}% read · your place is
                    saved
                  </small>
                  <button
                    className="text-button"
                    onClick={() => setActive(recent)}
                  >
                    Continue reading <ArrowUpRight size={17} />
                  </button>
                </div>
                <span
                  className="continue-decoration"
                  lang="ar"
                  aria-hidden="true"
                >
                  اقرأ
                </span>
              </section>
            )}
            <div className="shelf-header">
              <h2>
                Your books <span>{books.length}</span>
              </h2>
              <label className="library-search">
                <Search size={17} />
                <input
                  aria-label="Search your library"
                  placeholder="Find a book"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            {books.length === 0 ? (
              <section className="empty-library">
                <div className="empty-books" aria-hidden="true">
                  <span />
                  <span lang="ar">بداية</span>
                  <span />
                </div>
                <h2>A good place to begin.</h2>
                <p>
                  Bring an Arabic EPUB from Files.
                  <br />
                  Your books and your place stay on this device.
                </p>
                <button
                  className="secondary-button"
                  onClick={() => void sample()}
                  disabled={importing || !ready}
                >
                  <BookOpen size={17} /> Try a short Arabic read
                </button>
                <span className="small-note">
                  An original three-chapter sample, included with Waraq.
                </span>
              </section>
            ) : (
              <div className="book-grid">
                {visible.map((book) => (
                  <article className="book-card" key={book.id}>
                    <button
                      className="open-book"
                      aria-label={`Read ${book.title}`}
                      onClick={() => setActive(book)}
                    >
                      <Cover book={book} />
                      <h3 dir="auto">{book.title}</h3>
                      <p dir="auto">{book.author}</p>
                    </button>
                    <div className="book-meta">
                      <span>
                        {book.lastRead
                          ? `${Math.round(book.progress * 100)}% read`
                          : "NEW"}
                      </span>
                      <button
                        className="icon-button"
                        aria-label={`Book options for ${book.title}`}
                        onClick={() =>
                          setRemove(remove === book.id ? null : book.id)
                        }
                      >
                        <MoreHorizontal size={19} />
                      </button>
                    </div>
                    {remove === book.id && (
                      <div className="book-actions">
                        <button className="text-button" onClick={()=>{setEditing(book);setRemove(null);}}><Pencil size={15}/> Edit title & author</button>
                        <p>
                          Remove from this device? Keep your original EPUB in
                          Files.
                        </p>
                        <button
                          className="danger-button"
                          onClick={() => {
                            void removeBook(book.id)
                              .then(refresh)
                              .then(() => setRemove(null));
                          }}
                        >
                          <Trash2 size={15} /> Remove book
                        </button>
                        <button
                          className="text-button"
                          onClick={() => setRemove(null)}
                        >
                          Keep book
                        </button>
                      </div>
                    )}
                  </article>
                ))}
                {visible.length === 0 && (
                  <p className="subtle">No books match “{query}”.</p>
                )}
              </div>
            )}
            <footer className="library-footer">
              <span>
                <span className="status-dot" /> Your library lives on this
                device
              </span>
              <button
                className="text-button"
                onClick={() => setPreferences(true)}
              >
                Dictionaries & downloads <ArrowUpRight size={14} />
              </button>
            </footer>
          </main>
        </div>
      )}
      {preferences && (
        <Settings
          onClose={() => {
            setPreferences(false);
            void refresh();
          }}
          onNotice={setNotice}
        />
      )}
      {editing && <BookEditor book={editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);void refresh();setNotice('Book details saved.');}}/>}
      {(notice || offlineReady || needRefresh) && (
        <div className="toast" role="status">
          <span>
            {notice ||
              (needRefresh
                ? "An update is ready. Your library and progress will be kept."
                : "Waraq is ready for offline reading.")}
          </span>
          {needRefresh ? (
            <button onClick={() => void updateServiceWorker(true)}>
              Update
            </button>
          ) : null}
          <button
            aria-label="Dismiss notification"
            onClick={() => {
              setNotice("");
              setOfflineReady(false);
              setNeedRefresh(false);
            }}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
