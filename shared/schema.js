function createItem(partial){
  const now = nowISO();
  return Object.assign({
    id: uuid(),
    title: "",
    url: "",
    status: "todo", // 'todo' | 'done'
    category: "Other",
    tags: [],
    notes: "",
    source: "",
    added_at: now,
    updated_at: now,
    completed_at: null
  }, partial);
}
