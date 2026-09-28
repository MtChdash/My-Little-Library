# My Little Library

A personal reading archive with shelves, notes, ratings, and a song for each book.

## GitHub Pages layout

- `/` — public landing page (`index.html`)
- `/app/` — existing Web App, copied without rewriting its storage or features

For GitHub Pages, publish the `main` branch from the repository root (`/`). The landing page links to `./app/`, so it works at a project Pages URL such as `https://USERNAME.github.io/my-little-library/`.

## Data and moving from the earlier URL

Books live in each browser's local storage under `little-library-v1`. Shelves and the uploaded title font use separate local browser storage. There is no account or sync. A new GitHub Pages origin cannot read the library stored at the previous Site origin.

To move existing books: open the previous app, choose **Settings → Download backup**, then open the GitHub Pages app and choose **Settings → Restore backup**. The backup contains books, covers, notes, status, ratings, and cassette artwork. If you uploaded a custom title font, upload it again in the new app's Settings; the font is kept locally on the device, and is not included in the public repository or the library backup.

Do not delete the previous app or its browser data before checking that the new app has all books.

## PWA

The manifest and service worker live under `/app/`, with relative `start_url` and `scope`. On HTTPS GitHub Pages, installation is optional. The landing page remains a regular web page.
