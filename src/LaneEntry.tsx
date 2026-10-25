import { useState } from 'react';
import type { DictionaryEntry } from './types';
import { ArabicLinks } from './Dictionary';
export default function LaneEntry({entry,onLookup}:{entry:DictionaryEntry;onLookup:(word:string)=>void}) {
  const [original,setOriginal]=useState(false);
  const blocks=entry.laneBlocks?.length ? entry.laneBlocks : entry.senses.flatMap(s => s.split(/(?=-[Ab]\d+-)/).map(text => ({label:text.match(/^-(\w+)-/)?.[1] || '',runs:[{text:text.replace(/^-\w+-/,''),emphasis:false}]})));
  return <div className="lane-reading">
    <div className="lane-controls"><button className="text-button" onClick={()=>setOriginal(!original)}>{original?'Reading layout':'Original paragraph'}</button></div>
    {!original && <p className="small-note">Lane’s wording, with its sense divisions and emphasized glosses. “Tropical” means figurative; citations and historical usage are retained.</p>}
    {original ? entry.senses.map((text,i)=><p key={i}><ArabicLinks text={text} onLookup={onLookup}/></p>) : blocks.map((block,i)=><div className="lane-sense" key={i}>
      {block.label && <span className="eyebrow">Sense {block.label}</span>}
      <p>{block.runs.map((run,j)=>run.emphasis ? <strong key={j}><ArabicLinks text={run.text} onLookup={onLookup}/></strong> : <ArabicLinks key={j} text={run.text} onLookup={onLookup}/>)}</p>
    </div>)}
  </div>;
}
