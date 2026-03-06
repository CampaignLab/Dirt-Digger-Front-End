# Council Story Search

Simple static frontend to search and browse stories from a CSV dataset.

## Files

- `index.html` - page structure and UI controls
- `styles.css` - responsive styling
- `app.js` - CSV loading/parsing/filtering/sorting/rendering
- `data/stories.csv` - dataset source

## Expected CSV columns

The header row must include exactly these columns:

1. `Name`
2. `Council`
3. `Ward`
4. `Headline`
5. `Description`
6. `DatePublished`
7. `Url`
8. `MediaOutlet`
9. `Descriptor`

## Run locally

Because the app fetches `data/stories.csv`, run it from a local server (not `file://`).

Example with Python:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Behavior

- Live case-insensitive partial filtering by `Name`, `Ward`, and `Council`
- Default ordering: newest date first, invalid/missing dates at the end
- Date parsing supports:
  - `YYYY-MM-DD`
  - `DD-MMM-YY`
  - relative values like `5 days ago`
  - other values parseable by `Date.parse`
- Invalid date placeholders (for example `########`) show `Date unavailable`
- Valid `http://` or `https://` URLs render as `Read source`; otherwise `Source unavailable`

## Extending data

Replace `data/stories.csv` with an updated file that keeps the same headers. No code changes are needed for additional rows.


