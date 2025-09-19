function createItem(partial){
  const now = nowISO();
  return Object.assign({
    id: uuid(),
    title: "",
    url: "",
    status: "todo", // 'todo' | 'done'
    category: "Other",
    priority: "medium", // 'low' | 'medium' | 'high'
    tags: [],
    notes: "",
    source: "",
    reminder_time: null, // ISO string or null
    added_at: now,
    updated_at: now,
    completed_at: null
  }, partial);
}