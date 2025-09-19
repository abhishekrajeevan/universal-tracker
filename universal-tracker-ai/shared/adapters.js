// Local adapter via chrome.storage.local
const LS_KEY = "items";
const localAdapter = {
  async getAll(){
    const data = await chrome.storage.local.get([LS_KEY]);
    return data[LS_KEY] || [];
  },
  async upsert(item){
    const data = await chrome.storage.local.get([LS_KEY]);
    const items = data[LS_KEY] || [];
    const i = items.findIndex(x=>x.id===item.id);
    if (i === -1) items.push(item);
    else if (!items[i].updated_at || items[i].updated_at <= item.updated_at) items[i] = item;
    await chrome.storage.local.set({[LS_KEY]: items});
  },
  async remove(id){
    const data = await chrome.storage.local.get([LS_KEY]);
    const items = (data[LS_KEY]||[]).filter(x=>x.id!==id);
    await chrome.storage.local.set({[LS_KEY]: items});
  }
};

// Simple queue using local storage
const QUEUE_KEY = "outbox";
const queueAdapter = {
  async enqueue(item){
    const data = await chrome.storage.local.get([QUEUE_KEY]);
    const q = data[QUEUE_KEY] || [];
    q.push(item);
    await chrome.storage.local.set({[QUEUE_KEY]: q});
  }
};
