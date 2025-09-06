// File: Code.gs
const SHEET_NAME = 'Items';

function sheet(){ 
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1,1,1,11).setValues([[
      'id','title','url','status','category','tags','notes','source','added_at','updated_at','completed_at'
    ]]);
  }
  return sh; 
}

function doGet(e){
  const sh = sheet();
  const rows = sh.getDataRange().getValues();
  const [header, ...data] = rows;
  const items = data.map(r => Object.fromEntries(header.map((h,i)=>[h,r[i]])));
  return ContentService
    .createTextOutput(JSON.stringify({items}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e){
  const body = JSON.parse(e.postData && e.postData.contents || "{}");
  const items = body.items || (body.item ? [body.item] : []);
  const sh = sheet();
  const header = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const idIdx = header.indexOf('id') + 1;
  const lastRow = sh.getLastRow();

  const ids = (lastRow>1) ? sh.getRange(2, idIdx, lastRow-1, 1).getValues().flat().map(x=>String(x)) : [];
  const index = new Map(ids.map((v,i)=>[v, i+2]));

  items.forEach(it => {
    const row = header.map(h => (h in it) ? it[h] : "");
    const existing = index.get(String(it.id));
    if (existing) {
      sh.getRange(existing, 1, 1, header.length).setValues([row]);
    } else {
      sh.appendRow(row);
    }
  });

  return ContentService
    .createTextOutput(JSON.stringify({ok:true, upserted:items.length}))
    .setMimeType(ContentService.MimeType.JSON);
}
