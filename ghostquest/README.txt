GHOSTQUEST - APP FOLDER
=========================

This folder is the whole app. Put it on any web host and it becomes a real,
installable app with a live OpenStreetMap map and your phone's location.

WHY IT NEEDS A WEB ADDRESS
Phones only share location, and only allow "Add to Home Screen" full-screen
apps, for pages opened from a secure web address (https://...). A file opened
from the Files app cannot do either.

EASIEST WAYS TO PUT IT ONLINE (free)
1. Netlify Drop: go to app.netlify.com/drop and upload this zip (or the
   unzipped folder). You get an https:// address in seconds.
2. Cloudflare Pages: Workers & Pages > Create > Pages > Upload assets.
3. GitHub Pages: upload the files to a repository and switch on Pages.
(Check each site for its current steps; they change from time to time.)

THEN, ON THE iPAD OR PHONE
1. Open the address in Safari.
2. Tap Share > Add to Home Screen. It now opens full screen like an app.
3. Open it, go to the Stone Path, tap "Use my location" and allow location.
4. Set a maximum distance and tap "Generate destination".

GOOGLE OPTIONS
- Google Sites cannot run this app. It only shows a page inside a frame that
  blocks location, install-to-home-screen and offline mode.
- Firebase Hosting (Google's own free web hosting, https included) works well,
  but as far as I know you normally put files on it with a command-line tool on
  a computer. From an iPad, Netlify Drop or Cloudflare Pages is simpler.

ORGANIC MAPS / MAPS.ME
These are separate apps. They cannot be placed inside a web page, but the game
hands them the destination with one tap ("Open in Organic Maps"). If they are
installed, you get their detailed offline maps and walking directions. This
works on the phone or iPad that has the app.

WHAT TO KNOW
- The map library (Leaflet) loads from unpkg.com the first time and is then
  saved for offline use. The map pictures come from openstreetmap.org.
- OpenStreetMap's free tile server is fine for testing and light use. Before a
  public launch, switch to a map provider whose terms allow your traffic
  (for example MapTiler, Stadia Maps or your own Protomaps files) and change
  the tile address in index.html (search for tile.openstreetmap.org).
- A random coordinate is not a checked place. The game says so on screen.
- When you publish new files, change VERSION in sw.js (for example gq-v2) so
  devices pick up the update.
- MAPS.ME cannot show its maps inside a web page. The game hands the
  coordinate over with a copy button and a link instead.
