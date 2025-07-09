import ShaderPad from 'shaderpad';
import handleTouch from './handleTouch';

async function getWebcamStream() {
	const video = document.createElement('video');
	video.autoplay = video.playsInline = true;

	try {
		const stream = await navigator.mediaDevices.getUserMedia({ video: true });
		video.srcObject = stream;
		await new Promise(resolve => (video.onloadedmetadata = resolve));
	} catch (error) {
		console.error('Error accessing webcam:', error);
		throw error;
	}

	return video;
}

async function main() {
	const fragmentShaderSrc = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform int u_frame;
uniform highp sampler2DArray u_history;
uniform sampler2D u_webcam;
uniform float u_gridLength;

out vec4 fragColor;

vec2 getOffsetDirection(vec2 xy) {
    int x = int(xy.x);
    int y = int(xy.y);

    // Simple hash for pseudo-randomness.
    int h = x * 374761393 + y * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    h = h ^ (h >> 16);
    int dx = ((h >> 1) % 3) - 1; // -1, 0, or 1
    int dy = ((h >> 3) % 3) - 1; // -1, 0, or 1

    // if(dx == 0 && dy == 0) {
    //     dx = (x + y) % 2;
    //     dy = 1 - dx;
    // }

    return vec2(float(dx), float(dy));
}

void main() {
    vec2 uv = v_uv;
    vec2 gridXY = floor(uv * u_gridLength);

    vec2 mirroredUV = vec2(1.0 - uv.x, uv.y);
    vec4 webcamColor = texture(u_webcam, mirroredUV);

    ivec2 texSize = textureSize(u_history, 0).xy;
    vec2 offsetDirection = getOffsetDirection(gridXY);
    vec2 pixelOffset = offsetDirection / float(texSize);
    vec2 offsetUV = mod(uv + pixelOffset, 1.0);
    vec4 historyColor = texture(u_history, vec3(offsetUV, 0.0));

    // If frame is 0 or offset direction is (0,0), use webcam color.
    float hasOffset = max(abs(offsetDirection.x), abs(offsetDirection.y));
    fragColor = mix(webcamColor, historyColor, step(0.5, float(u_frame) * hasOffset));
}`;

	const video = await getWebcamStream();

	const outputCanvas = document.createElement('canvas');
	outputCanvas.width = video.videoWidth;
	outputCanvas.height = video.videoHeight;
	outputCanvas.style.position = 'fixed';
	outputCanvas.style.inset = '0';
	outputCanvas.style.width = '100vw';
	outputCanvas.style.height = '100vh';
	document.body.appendChild(outputCanvas);

	const shader = new ShaderPad(fragmentShaderSrc, { canvas: outputCanvas, history: 1 });

	// State.
	let gridLength = 64;
	let isPlaying = true;

	shader.initializeUniform('u_gridLength', 'float', gridLength);
	shader.initializeTexture('u_webcam', video);

	document.addEventListener('keydown', e => {
		switch (e.key) {
			case 'ArrowUp':
				gridLength += 1;
				shader.updateUniforms({ u_gridLength: gridLength });
				break;
			case 'ArrowDown':
				gridLength = Math.max(2, gridLength - 1);
				shader.updateUniforms({ u_gridLength: gridLength });
				break;
			case ' ':
				isPlaying = !isPlaying;
				isPlaying ? shader.play() : shader.pause();
				break;
			case 's':
				shader.save('shifter');
				break;
		}
	});

	handleTouch(document.body, (direction, diff) => {
		gridLength = Math.max(2, gridLength + Math.sign(diff) * (direction === 'y' ? -1 : 1));
		shader.updateUniforms({ u_gridLength: gridLength });
	});

	shader.play(() => {
		shader.updateTextures({ u_webcam: video });
	});
}

document.addEventListener('DOMContentLoaded', main);
