import { Book } from "epubjs";
import JSZip from "jszip";
import { storeBook } from "./storage";
import type { BookRecord } from "./types";
import { sha256 } from './platform';

export async function importBook(file: File): Promise<BookRecord> {
  if (!/\.epub$/i.test(file.name))
    throw new Error(
      "Choose an EPUB file. PDF support is planned for a later version.",
    );
  if (file.size > 100 * 1024 * 1024)
    throw new Error(
      "Please choose an EPUB smaller than 100 MB for this first version.",
    );
  const original = await file.arrayBuffer();
  const id = await sha256(original);
  const zip = await JSZip.loadAsync(original);
  if (!zip.file("META-INF/container.xml"))
    throw new Error("This file is not a valid EPUB.");
  if (zip.file("META-INF/encryption.xml")) {
    const encryption = await zip
      .file("META-INF/encryption.xml")!
      .async("string");
    const methods = new DOMParser()
      .parseFromString(encryption, "application/xml")
      .getElementsByTagNameNS("*", "EncryptionMethod");
    if (
      !methods.length ||
      Array.from(methods).some(
        (method) =>
          ![
            "http://www.idpf.org/2008/embedding",
            "http://ns.adobe.com/pdf/enc#RC",
          ].includes(method.getAttribute("Algorithm") || ""),
      )
    )
      throw new Error("This EPUB is encrypted. Please import a DRM-free copy.");
  }
  const paths = Object.keys(zip.files);
  if (paths.length > 10000)
    throw new Error("This EPUB contains too many resources.");
  for (const path of paths) {
    if (/\.(xhtml|html|htm|svg|opf)$/i.test(path)) {
      const raw = await zip.files[path].async("string");
      const doc = new DOMParser().parseFromString(raw, "application/xhtml+xml");
      if (doc.querySelector("parsererror"))
        throw new Error(`The EPUB contains malformed markup (${path}).`);
      doc
        .querySelectorAll("script,iframe,object,embed,form,base,foreignObject")
        .forEach((el) => el.remove());
      doc.querySelectorAll("*").forEach((el) => {
        for (const attr of [...el.attributes]) {
          const resource = [
            "href",
            "src",
            "xlink:href",
            "action",
            "formaction",
          ].includes(attr.name);
          if (
            /^on/i.test(attr.name) ||
            ["srcdoc", "srcset"].includes(attr.name) ||
            (resource &&
              /^(?:javascript:|https?:|\/\/|data:text\/html)/i.test(
                attr.value.trim(),
              ))
          )
            el.removeAttribute(attr.name);
        }
      });
      const head = doc.querySelector("head");
      if (head) {
        const meta = doc.createElementNS(
          "http://www.w3.org/1999/xhtml",
          "meta",
        );
        meta.setAttribute("http-equiv", "Content-Security-Policy");
        meta.setAttribute(
          "content",
          "default-src 'none'; img-src blob: data:; style-src 'unsafe-inline' blob:; font-src blob: data:; script-src 'none'; connect-src 'none'; form-action 'none'",
        );
        head.prepend(meta);
      }
      zip.file(path, new XMLSerializer().serializeToString(doc));
    }
  }
  const data = await zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
  });
  const epub = new Book({ replacements: "blobUrl" });
  try {
    await epub.open(data, "binary");
    const metadata = await epub.loaded.metadata;
    let cover: Blob | undefined;
    const coverUrl = await epub.coverUrl().catch(() => null);
    if (coverUrl?.startsWith("blob:"))
      cover = await (await fetch(coverUrl)).blob();
    const book: BookRecord = {
      id,
      title: metadata.title || file.name.replace(/\.epub$/i, ""),
      author: metadata.creator || "Unknown author",
      addedAt: Date.now(),
      lastRead: 0,
      data: new Blob([data], { type: "application/epub+zip" }),
      size: file.size,
      cover,
      progress: 0,
      bookmarks: [],
    };
    await storeBook(book);
    return book;
  } finally {
    epub.destroy();
  }
}
