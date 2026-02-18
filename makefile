xpi: 
	rm -f ./*.xpi
	zip -r -9 TitleTamer.xpi manifest.json src/ -x '*/.*' >/dev/null 2>/dev/null
