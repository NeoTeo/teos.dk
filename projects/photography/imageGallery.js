// Generated for teos.dk by ChatGPT4

function createObserver() {
	let observer;
	let options = {
		root: null,
		rootMargin: "0px",
		threshold: 0.1
	};
	observer = new IntersectionObserver(handleIntersect, options);
	document.querySelectorAll('.lazy').forEach(img => observer.observe(img));
}

function handleIntersect(entries, observer) {
	entries.forEach(entry => {
		if (entry.intersectionRatio > 0) {
			loadImage(entry.target);
			observer.unobserve(entry.target);
		}
	});
}

function loadImage(image) {
	image.src = image.dataset.src;
}

fetch(document.currentScript.getAttribute('data-filename'))
	.then(response => response.text())
	.then(data => {
		const lines = data.split('\n');
		const galleryDiv = document.getElementById('gallery');

		lines.forEach(line => {
			const parts = line.split(':');
			if (parts.length === 2) {
				const filename = parts[0].trim();
				const caption = parts[1].trim();

				const imageContainer = document.createElement('div');
				imageContainer.className = 'image-container';

				const img = document.createElement('img');
				img.dataset.src = filename;
				img.className = 'lazy';
				img.alt = caption;

				img.addEventListener('click', function() {
					let fullscreenBg = document.getElementById('fullscreen-bg');
					if (fullscreenBg) {
						document.body.removeChild(fullscreenBg);
					} else {
						fullscreenBg = document.createElement('div');
						fullscreenBg.id = 'fullscreen-bg';
						fullscreenBg.style = `
							position: fixed;
							top: 0;
							left: 0;
							width: 100%;
							height: 100%;
							background: rgba(0, 0, 0, 0.8);
							z-index: 9999;
							display: flex;
							justify-content: center;
							align-items: center;
						`;

						let fullscreenImg = this.cloneNode(true);
						fullscreenImg.style = `
							max-width: 80%;
							max-height: 80%;
							object-fit: contain;
							margin: auto;
						`;

						fullscreenBg.appendChild(fullscreenImg);
						document.body.appendChild(fullscreenBg);

						fullscreenBg.addEventListener('click', function() {
							document.body.removeChild(document.getElementById('fullscreen-bg'));
						});
					}
				});


				const captionDiv = document.createElement('div');
				captionDiv.textContent = caption;

				imageContainer.appendChild(img);
				imageContainer.appendChild(captionDiv);
				galleryDiv.appendChild(imageContainer);
			}
		});
		
		createObserver();
	});
