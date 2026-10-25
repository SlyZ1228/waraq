import { useEffect, useRef, useState } from "react";
import {
  Book,
  type Rendition,
  type Contents,
  type Location,
  type NavItem,
} from "epubjs";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  BookOpen,
  Bookmark,
  List,
  Type,
  Search,
  X,
  Check,
  Pointer,
} from "lucide-react";
import fontUrl from "@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-400-normal.woff2?url";
import { loadBookData, updateBook } from "./storage";
import { readBytes } from './platform';
import { arabicWord, cleanWord } from "./arabic";
import { themes } from "./themes";
import Dictionary from "./Dictionary";
import type { BookSummary, Lookup, ReaderSettings } from "./types";

function flatten(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => [item, ...flatten(item.subitems || [])]);
}
function wordAt(doc: Document, x: number, y: number): Range | null {
  const extended = doc as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range;
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number };
  };
  let point = extended.caretRangeFromPoint?.(x, y);
  if (!point) {
    const caret = extended.caretPositionFromPoint?.(x, y);
    if (caret) {
      point = doc.createRange();
      point.setStart(caret.offsetNode, caret.offset);
    }
  }
  if (!point || point.startContainer.nodeType !== Node.TEXT_NODE) return null;
  const text = point.startContainer.textContent || "";
  const offset = point.startOffset;
  for (const match of text.matchAll(new RegExp(arabicWord.source, "g"))) {
    if (offset >= match.index && offset <= match.index + match[0].length) {
      const range = doc.createRange();
      range.setStart(point.startContainer, match.index);
      range.setEnd(point.startContainer, match.index + match[0].length);
      if ([...range.getClientRects()].some(rect => x >= rect.left-3 && x <= rect.right+3 && y >= rect.top-3 && y <= rect.bottom+3)) return range;
    }
  }
  return null;
}

export default function Reader({
  book,
  settings,
  onSettings,
  onExit,
  onDownloads,
}: {
  book: BookSummary;
  settings: ReaderSettings;
  onSettings: (settings: ReaderSettings) => void;
  onExit: () => void;
  onDownloads: () => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    epub = useRef<Book | null>(null),
    rendition = useRef<Rendition | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [lookup, setLookup] = useState<Lookup | null>(null),
    [menu, setMenu] = useState<"type" | "toc" | null>(null);
  const [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [toc, setToc] = useState<NavItem[]>([]);
  const [chapter, setChapter] = useState(book.chapter || ""),
    [progress, setProgress] = useState(book.progress),
    [bookmarks, setBookmarks] = useState(book.bookmarks);
  const [currentCfi, setCurrentCfi] = useState(book.location || ""),
    [atStart, setAtStart] = useState(false),
    [atEnd, setAtEnd] = useState(false);
  const [selectionHint, setSelectionHint] = useState(""),
    [rtl, setRtl] = useState(true);
  const highlight = useRef<string | undefined>(undefined);
  const retainedCfi = useRef<string | undefined>(book.location);
  const fontBlob = useRef("");
  const mounted = useRef(true);
  function applyTheme() {
    const r = rendition.current;
    if (!r) return;
    const s = settingsRef.current,
      t = themes[s.theme];
    r.themes.default({
      body: {
        color: `${t.ink} !important`,
        background: `${t.paper} !important`,
      },
      "p,li,blockquote": { "line-height": `${s.lineHeight} !important` },
      a: { color: `${t.accent} !important` },
      "h1,h2,h3": { "line-height": "1.7 !important" },
      "::selection": { background: "#bacab1" },
    });
    r.themes.fontSize(`${s.fontSize}px`);
    r.themes.font('"Reader Arabic", Georgia, serif');
  }
  useEffect(() => {
    let alive = true,
      restored = false;
    mounted.current = true;
    const b = new Book({ replacements: "blobUrl" });
    epub.current = b;
    let lastWidth = 0,
      lastHeight = 0;
    let latestCfi = book.location;
    async function settleFont(r: Rendition) {
      const returned = r.getContents();
      const contents: Contents[] = Array.isArray(returned) ? returned : [returned];
      await Promise.all(contents.map(content => content.document.fonts.load(`${settingsRef.current.fontSize}px "Reader Arabic"`)));
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }
    const resizeToHost = () => {
      const r = rendition.current;
      if (!alive || !restored || !r || !host.current) return;
      const {clientWidth:width,clientHeight:height} = host.current;
      if (width === lastWidth && height === lastHeight) return;
      lastWidth=width;lastHeight=height;
      const target=latestCfi;
      retainedCfi.current=target;
      restored=false;
      // EPUB.js recreates the iframe on resize. Its first pagination uses fallback
      // font metrics; retain the pre-resize CFI until the Arabic font settles.
      const resize = r.resize as (width:number,height:number,cfi?:string)=>void;
      resize.call(r,width,height,target);
      void (async()=>{
        await r.display(target);
        if (!alive) return;
        await settleFont(r);
        if (alive && target) await r.display(target);
      })().catch(()=>{if(alive)setSelectionHint('Page layout could not be restored. Reopen this book to return to your saved place.');})
        .finally(async()=>{
          if (!alive) return;
          restored=true;
          await r.reportLocation();
          resizeToHost();
        });
    };
    const observe = new ResizeObserver(resizeToHost);
    const select = (range: Range, contents: Contents) => {
      const word = cleanWord(range.toString());
      if (!word || word.length > 80 || /\s/.test(word)) {
        setSelectionHint(
          "Select one word, or search for a root in the sidebar.",
        );
        return;
      }
      if (highlight.current)
        rendition.current?.annotations.remove(highlight.current, "highlight");
      const cfi = contents.cfiFromRange(range);
      highlight.current = cfi;
      rendition.current?.annotations.highlight(
        cfi,
        {},
        undefined,
        "word-highlight",
        { fill: "#98b087", "fill-opacity": "0.25" },
      );
      setLookup({ word, kind: "word" });
      setSelectionHint("");
    };
    (async () => {
      const data = await loadBookData(book.id);
      if (!data)
        throw new Error(
          "This book is no longer in local storage. Import it again from Files.",
        );
      const font = new Blob([await readBytes(fontUrl)],{type:'font/woff2'});
      fontBlob.current = URL.createObjectURL(font);
      await b.open(await data.arrayBuffer(), "binary");
      await b.ready;
      if (!alive) return;
      const nav = flatten(b.navigation.toc);
      setToc(nav);
      const metadata = b.packaging.metadata as typeof b.packaging.metadata & {
        direction?: string;
      };
      const isRtl =
        metadata.direction === "rtl" || metadata.language?.startsWith("ar");
      setRtl(isRtl);
      const r = b.renderTo(host.current!, {
        width: "100%",
        height: "100%",
        spread: "none",
        flow: "paginated",
        allowScriptedContent: false,
        defaultDirection: isRtl ? "rtl" : "ltr",
      });
      rendition.current = r;
      r.hooks.content.register((contents: Contents) => {
        void contents.addStylesheetCss(
          `@font-face{font-family:'Reader Arabic';src:url('${fontBlob.current}') format('woff2');font-weight:400;} body{padding:20px 24px !important;} p{orphans:2;widows:2;} a{overflow-wrap:anywhere;}`,
          "reader-font",
        );
        let down = { x: 0, y: 0, time: 0 };
        contents.document.addEventListener("pointerdown", (event) => {
          down = { x: event.clientX, y: event.clientY, time: Date.now() };
        });
        contents.document.addEventListener("pointerup", (event) => {
          if (
            !alive ||
            !settingsRef.current.lookupMode ||
            Date.now() - down.time > 500 ||
            Math.hypot(event.clientX - down.x, event.clientY - down.y) > 10
          )
            return;
          if ((event.target as Element).closest?.("a,button,input")) return;
          if (contents.window.getSelection()?.toString()) return;
          const range = wordAt(contents.document, event.clientX, event.clientY);
          if (range) select(range, contents);
        });
        contents.document.addEventListener("keydown", (event) => {
          if (event.key === "Escape") setLookup(null);
          if (event.key === "ArrowLeft") navigate(isRtl ? 'next' : 'prev');
          if (event.key === "ArrowRight") navigate(isRtl ? 'prev' : 'next');
        });
        contents.document.addEventListener('click',event=>{
          if ((event.target as Element).closest?.('a')) retainedCfi.current=undefined;
        },true);
      });
      r.on("selected", (cfi: string, contents: Contents) => {
        if (alive) select(contents.range(cfi), contents);
      });
      r.on("relocated", (location: Location) => {
        if (!alive || !restored) return;
        const { href, index, displayed } = location.start;
        // A reflow changes page boundaries, not the reader's actual text anchor.
        // Keep that anchor until an intentional page/chapter navigation.
        const cfi=retainedCfi.current || location.start.cfi;
        latestCfi = cfi;
        const name =
          nav
            .find((item) => item.href.split("#")[0] === href.split("#")[0])
            ?.label.trim() || `Section ${index + 1}`;
        let total = 0;
        b.spine.each(() => total++);
        const fraction = location.atEnd
          ? 1
          : Math.max(
              0,
              Math.min(
                1,
                (index + (displayed.page - 1) / Math.max(1, displayed.total)) /
                  (total || 1),
              ),
            );
        setCurrentCfi(cfi);
        setChapter(name);
        setProgress(fraction);
        setAtStart(location.atStart);
        setAtEnd(location.atEnd);
        void updateBook(book.id, {
          location: cfi,
          progress: fraction,
          chapter: name,
          lastRead: Date.now(),
        }).catch(() =>
          setError(
            "Your reading position could not be saved. Check available storage.",
          ),
        );
      });
      applyTheme();
      try {
        await r.display(book.location || undefined);
        // EPUB.js positions the first view before content hooks load its reader font.
        // Reapply the saved CFI after font metrics and pagination have settled.
        await settleFont(r);
        if (book.location && alive) await r.display(book.location);
      } catch {
        await r.display();
        setSelectionHint(
          "The saved position could not be restored; opened at the beginning.",
        );
      }
      if (!alive) return;
      restored = true;
      await r.reportLocation();
      lastWidth = host.current!.clientWidth;
      lastHeight = host.current!.clientHeight;
      observe.observe(host.current!);
      setBusy(false);
    })().catch((e) => {
      if (alive) {
        setError(e instanceof Error ? e.message : String(e));
        setBusy(false);
      }
    });
    return () => {
      alive = false;
      mounted.current = false;
      observe.disconnect();
      rendition.current = null;
      b.destroy();
      epub.current = null;
      if (fontBlob.current) URL.revokeObjectURL(fontBlob.current);
    };
  }, [book.id]);
  useEffect(() => {
    applyTheme();
  }, [settings]);
  const marked = bookmarks.some((mark) => mark.cfi === currentCfi);
  async function bookmark() {
    if (!currentCfi) return;
    const next = marked
      ? bookmarks.filter((mark) => mark.cfi !== currentCfi)
      : [...bookmarks, { cfi: currentCfi, label: chapter || "Bookmark" }];
    setBookmarks(next);
    await updateBook(book.id, { bookmarks: next });
  }
  const navigate = (direction: "prev" | "next") => {
    retainedCfi.current=undefined;
    void rendition.current?.[direction]().catch((e) => setError(String(e)));
  };
  return (
    <div className={`reader-screen ${lookup ? "has-dictionary" : ""}`}>
      <div className="reader-main">
        <header className="reader-toolbar">
          <button className="text-button" onClick={onExit}>
            <ChevronLeft size={21} /> Library
          </button>
          <div className="reading-title">
            <span dir="auto">{book.title}</span>
            <small dir="auto">{chapter || book.author}</small>
          </div>
          <div className="button-row">
            <button
              className={`icon-button ${menu === "toc" ? "active" : ""}`}
              aria-label="Table of contents"
              onClick={() => setMenu(menu === "toc" ? null : "toc")}
            >
              <List size={21} />
            </button>
            <button
              className={`icon-button ${marked ? "active" : ""}`}
              aria-label={marked ? "Remove bookmark" : "Add bookmark"}
              onClick={() => void bookmark()}
              disabled={!currentCfi}
            >
              <Bookmark size={20} fill={marked ? "currentColor" : "none"} />
            </button>
            <button
              className={`icon-button ${menu === "type" ? "active" : ""}`}
              aria-label="Reading appearance"
              onClick={() => setMenu(menu === "type" ? null : "type")}
            >
              <Type size={21} />
            </button>
            <button
              className="icon-button"
              aria-label="Open dictionary search"
              onClick={() => setLookup({ word: "كتاب", kind: "word" })}
            >
              <Search size={20} />
            </button>
          </div>
        </header>
        {menu && (
          <div
            className={`reader-popover ${menu === "toc" ? "contents-popover" : ""}`}
          >
            <header>
              <h2>
                {menu === "type" ? "Make yourself comfortable" : "Contents"}
              </h2>
              <button
                className="icon-button"
                aria-label="Close reading menu"
                onClick={() => setMenu(null)}
              >
                <X size={18} />
              </button>
            </header>
            {menu === "type" ? (
              <>
                <div className="theme-options">
                  {Object.entries(themes).map(([id, theme]) => (
                    <button
                      key={id}
                      className={`theme-option ${settings.theme === id ? "selected" : ""}`}
                      onClick={() =>
                        onSettings({
                          ...settings,
                          theme: id as ReaderSettings["theme"],
                        })
                      }
                    >
                      <span
                        style={{ background: theme.paper, color: theme.ink }}
                      >
                        أ{settings.theme === id && <Check size={12} />}
                      </span>
                      {theme.label}
                    </button>
                  ))}
                </div>
                <label className="range-label">
                  Text size <span>{settings.fontSize}px</span>
                  <input
                    aria-label="Text size"
                    type="range"
                    min="18"
                    max="38"
                    value={settings.fontSize}
                    onChange={(e) =>
                      onSettings({ ...settings, fontSize: +e.target.value })
                    }
                  />
                </label>
                <label className="range-label">
                  Line spacing <span>{settings.lineHeight.toFixed(1)}</span>
                  <input
                    aria-label="Line spacing"
                    type="range"
                    min="1.5"
                    max="2.5"
                    step="0.1"
                    value={settings.lineHeight}
                    onChange={(e) =>
                      onSettings({ ...settings, lineHeight: +e.target.value })
                    }
                  />
                </label>
                <label className="switch-label">
                  <span>
                    <Pointer size={16} /> Tap a word to look it up
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.lookupMode}
                    onChange={(e) =>
                      onSettings({ ...settings, lookupMode: e.target.checked })
                    }
                  />
                </label>
                <p className="small-note">
                  You can also press and hold to select a word.
                </p>
              </>
            ) : (
              <>
                <div className="toc-items">
                  {toc.map((item, i) => (
                    <button
                      key={`${item.href}-${i}`}
                      dir="auto"
                      onClick={() => {
                        retainedCfi.current=undefined;
                        void rendition.current?.display(item.href);
                        setMenu(null);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                  {!toc.length && (
                    <p className="subtle">
                      This book has no table of contents.
                    </p>
                  )}
                </div>
                {bookmarks.length > 0 && (
                  <>
                    <h3 className="eyebrow">Bookmarks</h3>
                    {bookmarks.map((mark) => (
                      <button
                        className="toc-bookmark"
                        key={mark.cfi}
                        onClick={() => {
                          retainedCfi.current=mark.cfi;
                          void rendition.current?.display(mark.cfi);
                          setMenu(null);
                        }}
                      >
                        <Bookmark size={15} />
                        <span dir="auto">{mark.label}</span>
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        )}
        <div className="reading-area">
          <button className="page-edge left" aria-label="Turn page left" title={rtl?'Next page':'Previous page'} disabled={busy || !!error || (rtl?atEnd:atStart)} onClick={()=>navigate(rtl?'next':'prev')}><ArrowLeft size={20}/></button>
          <div ref={host} className="epub-host" aria-label="Book text" />
          <button className="page-edge right" aria-label="Turn page right" title={rtl?'Previous page':'Next page'} disabled={busy || !!error || (rtl?atStart:atEnd)} onClick={()=>navigate(rtl?'prev':'next')}><ArrowRight size={20}/></button>
          {busy && (
            <div className="reader-loading">
              <BookOpen size={29} />
              <p>Opening your book…</p>
            </div>
          )}
          {error && (
            <div className="reader-error">
              <p>{error}</p>
              <button className="secondary-button" onClick={onExit}>
                Back to library
              </button>
            </div>
          )}
        </div>
        <footer className="reader-footer">
          <button
            className="page-button"
            aria-label={rtl ? "Next page" : "Previous page"}
            disabled={busy || (rtl ? atEnd : atStart)}
            onClick={() => navigate(rtl ? "next" : "prev")}
          >
            <ArrowLeft size={21} />
          </button>
          <div>
            <span dir="auto">{chapter}</span>
            <small>
              {selectionHint ||
                `${Math.round(progress * 100)}% · saved on this device`}
            </small>
          </div>
          <button
            className="page-button"
            aria-label={rtl ? "Previous page" : "Next page"}
            disabled={busy || (rtl ? atStart : atEnd)}
            onClick={() => navigate(rtl ? "prev" : "next")}
          >
            <ArrowRight size={21} />
          </button>
        </footer>
      </div>
      {lookup && (
        <Dictionary
          initial={lookup}
          onClose={() => setLookup(null)}
          onSettings={onDownloads}
        />
      )}
    </div>
  );
}
