xpi: 
	rm -f ./*.xpi
	zip -r -9 TitleTamer.xpi manifest.json *.js *.css *.html *.svg -x '*/.*' >/dev/null 2>/dev/null
