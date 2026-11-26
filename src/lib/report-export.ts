export interface ReportSection { title:string; rows:Record<string,unknown>[] }
const cell = (v:unknown):string => typeof v==="object" ? JSON.stringify(v) : String(v??"");
// Do not allow spreadsheet formulas in user-controlled report text.
export const safeSpreadsheetText=(value:unknown)=>{const s=cell(value);return /^[=+@\-\t\r]/.test(s)?`'${s}`:s;};
export async function exportReport(format:"pdf"|"xlsx",title:string,sections:ReportSection[]) {
  const filename=title.replace(/[^a-zA-Z0-9-]/g,"-").slice(0,100);
  if(format==="xlsx"){
    const XLSX=await import("xlsx");const wb=XLSX.utils.book_new();
    for(const section of sections){const rows=section.rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,typeof v==="number"?v:safeSpreadsheetText(v)])));XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),section.title.slice(0,31));}
    XLSX.writeFile(wb,`${filename}.xlsx`);return;
  }
  const {jsPDF}=await import("jspdf");const doc=new jsPDF();let y=20;
  const line=(text:string,size=9)=>{doc.setFontSize(size);const lines:string[]=doc.splitTextToSize(text,175);for(const l of lines){if(y>278){doc.addPage();y=20;}doc.text(l,18,y);y+=size===9?5:7;}};
  line(title,16);line(`Generated ${new Date().toISOString()}`);line("Risk indicators require human review and never establish guilt.");y+=4;
  for(const section of sections){line(section.title,12);for(const row of section.rows){for(const [k,v] of Object.entries(row))line(`${k}: ${cell(v)}`);y+=4;}}
  const total=doc.getNumberOfPages();for(let i=1;i<=total;i++){doc.setPage(i);doc.setFontSize(8);doc.text(`FINANCIAL IQ | Confidential | ${i} / ${total}`,18,290);}
  doc.save(`${filename}.pdf`);
}