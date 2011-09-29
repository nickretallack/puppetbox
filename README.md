Puppet Box
===

This is a very simple app that lets you paste images into your browser and drag them around collaboratively with friends.  Hopefully this will encourage people to make up their own little games with these draggable images.

Currently only Google Chrome is supported.

Dependencies
---
You need to check out my javascript-libraries repo next to this one.  This is just a collection of scripts that I use in a lot of differeapps.  It's a total mess right now and could use some cleanup, but that'd break all my other projects so I am lazy about it.

To run the server you need node.js and the following npm modules: express, socket.io

To compile the Coffee-Script into JavaScript, install the coffee-script npm module and run the coffee compiler as a watchdog wth `coffee -wc *.coffee` so it'll compile automatically while you code.
