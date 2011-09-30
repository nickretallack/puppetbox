Puppet Box
===

This is a very simple app that lets you paste images into your browser and drag them around collaboratively with friends.  Hopefully this will encourage people to make up their own little games with these draggable images.

Currently only Google Chrome is supported.

Dependencies
---
You need to check out my javascript-libraries repo next to this one.  This is just a collection of scripts that I use in a lot of differeapps.  It's a total mess right now and could use some cleanup, but that'd break all my other projects so I am lazy about it.

To run the server you need node.js and the following npm modules: express, socket.io

To compile the Coffee-Script into JavaScript, install the coffee-script npm module and run the coffee compiler as a watchdog wth `coffee -wc *.coffee` so it'll compile automatically while you code.

Todos:
---
* Make scoped "rooms" for this so it's not just one global application [DONE]
* Server-side persistence [DONE]
* Debounce database writes for movement [DONE]
* Selection info panel on the side [DONE]
* Delete objects [DONE]
* Work with real image files instead of just data urls
* De-dup images using hashes
* Move objects up/down in the stacking order
* Select multiple objects and manipulate them together
* Repeatedly stamp down the same image
* Globally replace an image
* File drag and drop
* List of recent rooms on front page
* Save states for rooms (set up the board for a board game)
* Text bubbles?
