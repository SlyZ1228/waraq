import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { BookSummary } from './types';
import { updateBook } from './storage';
export default function BookEditor({book,onClose,onSaved}:{book:BookSummary;onClose:()=>void;onSaved:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [title,setTitle]=useState(book.title),[author,setAuthor]=useState(book.author),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  useEffect(()=>{dialog.current?.showModal();},[]);
  async function save(e:React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {setError('Please enter a title.');return;}
    setSaving(true);
    try {await updateBook(book.id,{title:title.trim(),author:author.trim() || 'Unknown author',metadataEdited:true});onSaved();}
    catch {setError('Could not save the book details. Please try again.');setSaving(false);}
  }
  return <dialog ref={dialog} className="book-editor" onCancel={onClose} onClick={e=>{if(e.target===dialog.current)onClose();}}>
    <form onSubmit={e=>void save(e)}><header><h2>Edit book details</h2><button type="button" className="icon-button" aria-label="Close book editor" onClick={onClose}><X size={20}/></button></header>
      <label>Displayed title<input autoFocus dir="auto" maxLength={250} value={title} onChange={e=>setTitle(e.target.value)} required/></label>
      <label>Author<input dir="auto" maxLength={250} value={author} onChange={e=>setAuthor(e.target.value)}/></label>
      <p className="small-note">Changes apply to your library. Your EPUB and reading position are kept.</p>
      {error && <p className="notice" role="alert">{error}</p>}
      <footer><button type="button" className="text-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving?'Saving…':'Save changes'}</button></footer>
    </form>
  </dialog>;
}
