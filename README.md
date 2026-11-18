# Fingerprint Scanner

An animated fingerprint scanner for the browser, made with HTML, CSS, JavaScript and GSAP. You press and hold the fingerprint, a scan line runs over it, and you get "access granted" or "access denied" at the end.

Live demo: https://fingerly.netlify.app

## How it works

- Press and hold the fingerprint to scan. It works with a mouse or a finger.
- Let go before 100% and the scan pauses.
- At 100% you get access granted or access denied.
- The glow resets by itself, so you can scan again straight away.

The scan line, shimmer, particles and sparks are all animated with GSAP, and sound effects play along with the scan.

## Files

Everything lives in `index.html`, `style.css` and `script.js`, with the sound effects in the `sounds` folder. There's no build step, so you can open `index.html` in a browser to try it.
