# Create text indexes for post search

The search endpoint now prefers MongoDB text search before falling back to regular expressions. Run the commands below on the target database to provision the indexes that support the new query plan.

```javascript
use <your-database-name>;

db.posts.createIndexes([
  {
    key: { title: "text", tags: "text" },
    name: "posts_text_search",
    weights: { title: 10, tags: 5 },
    default_language: "portuguese",
  },
  {
    key: { date: -1 },
    name: "posts_date_desc",
  },
]);
```

The weighted text index optimises the `$text` search, while the descending date index keeps the fallback query efficient when results need to be sorted by recency.
