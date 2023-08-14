const { Midi } = require("@tonejs/midi");
const bsCustomFileInput = require("bs-custom-file-input");
const MidiParser = require("./midi-parser.js");

bsCustomFileInput.init();

let player = null;
const synths = [];
let parser;
class Markov {
	constructor(groups, order) {
		this.orig = groups;
		let set = [...new Set(groups.map(group => group.id))];
		let dimension = set.length;
		this.set = set;
		this.matrix = new Array(dimension).fill(null).map(() => new Array(dimension).fill(0));
		this.table = new Array(dimension).fill(null).map(() => new Array());
		for (let index = 0; index <= groups.length - 2; index++) {
			let prev = groups[index];
			let next = groups[index + 1];
			this.matrix[set.indexOf(prev.id)][set.indexOf(next.id)] += 1;
			this.table[set.indexOf(prev.id)].push(set.indexOf(next.id));
		}
		console.log(this.matrix, this.table);
		this.chain = this.chainGenerator();
	}
	chainGenerator() {
		const chain = [];
		const start = Math.floor(Math.random() * this.set.length);
		let length = 0;
		let current = start;
		do {
			chain.push(current);
			current = this.next(current);
			length++;
		}
		while (current !== -1 && length < 50);
		console.log(chain);
		return chain;
	}
	next(cur) {
		const available = this.table[cur];
		if (available.length === 0) return -1;
		return available[Math.floor(Math.random() * available.length)];
	}
	sum(list) {
		return list.reduce((a, b) => a + b, 0);
	}
	normalize(list) {
		let sum = this.sum(list);
		if (sum === 0) return;
		let factor = 1 / sum;
		return list.map(item => item * factor);
	}
	graph(matrix) {
		;
	}
	random() {
		;
	}
}

class Instrument {
	constructor() {
		const pitch = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
		this.standard = {
			pitch : "A",
			octave: 4,
			freq  : 440
		};
		this.freq = {};
		for (let octave = 0; octave <= 8; octave++) {
			let deltaOctave = octave - this.standard.octave;
			for (let index = 0; index < 12; index++) {
				let offset = index - pitch.indexOf(this.standard.pitch);
				this.freq[pitch[index] + octave] = this.standard.freq * Math.pow(2, deltaOctave + offset / 12);
			}
		}
		this.AudioContext = new (window.AudioContext || window.webkitAudioContext);
	}
	async note(name, time = 500, type = "triangle") {
		if (!name) {
			console.log("START", "REST", time);
			return new Promise((resolve, reject) => {
				setTimeout(() => {
					console.log("STOP", "REST", time);
					resolve();
				}, time);
			});
		}
		let oscillator = this.AudioContext.createOscillator();
		let gainNode = this.AudioContext.createGain();
		oscillator.connect(gainNode);
		gainNode.connect(this.AudioContext.destination);
		oscillator.type = type;
		oscillator.frequency.value = this.freq[name];
		gainNode.gain.setValueAtTime(0, this.AudioContext.currentTime);
		gainNode.gain.linearRampToValueAtTime(1, this.AudioContext.currentTime + 0.01);
		gainNode.gain.setValueAtTime(1, this.AudioContext.currentTime + time / 1500);
		gainNode.gain.linearRampToValueAtTime(0, this.AudioContext.currentTime + time / 1000);
		//oscillator.connect(this.AudioContext.destination);
		oscillator.start(this.AudioContext.currentTime);
		oscillator.stop(this.AudioContext.currentTime + time / 1000);
		console.log("START", name, time);
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				//gainNode.gain.exponentialRampToValueAtTime(0.01, this.AudioContext.currentTime + 0.8);
				console.log("STOP", name, time);
				resolve();
			}, time);
		});
	}
	async chord(notes, time = 500, type) {
		return Promise.all(notes.map(note => this.note(note.name, time, type)));
	}
	async test() {
		await this.note("C4");
		await this.note("E4");
		await this.note("G4");
		await this.chord(["C4", "E4", "G4"]);
	}
}

class Player {
	constructor(chords, meta) {
		this.buffer = [...chords];
		this.playing = false;
		let { bpm, ts } = meta;
		let [beatsPerBar, beatUnit] = ts;
		this.barDuration = 60 / bpm * beatsPerBar * 1000;
	}
	async play() {
		this.instrument = new Instrument();
		console.log(this.instrument.freq);
		if (this.playing) return;
		this.playing = true;
		while (this.buffer.length && this.playing) {
			let { notes, time } = this.buffer.shift();
			time *= this.barDuration / 16;
			await this.instrument.chord(notes, time);
		}
		this.instrument = null;
	}
	pause() {
		this.playing = false;
	}
}

class MusiXTeX {
	constructor() {
		this.mapping = {
			1: 'cca',
			2: 'ca',
			3: 'cup',
			4: 'qa',
			6: 'qap',
			8: 'ha',
			12: 'hap',
			16: 'wh'
		};
		this.notehead = {
			1: 'zq',
			2: 'zq',
			3: 'zqp',
			4: 'zq',
			6: 'zqp',
			8: 'zh',
			12: 'zhp',
			16: 'zw'
		};
		const pitches = [
			index => "`" + String.fromCharCode(65 + index),
			index => String.fromCharCode(65 + index),
			index => String.fromCharCode(72 + index),
			index => String.fromCharCode(97 + index),
			index => String.fromCharCode(104 + index),
			index => String.fromCharCode(111 + index),
			index => String.fromCharCode(118 + index)
		];
		this.repr = {};
		for (let octave = 1; octave <= 7; octave++) {
			for (let index = 0; index < 7; index++) {
				let char = String.fromCharCode(65 + index);
				let level = index < 2 ? octave - 1 : octave;
				this.repr[char + level] = pitches[octave - 1](index);
				if ('CDFGA'.includes(char)) {
					this.repr[char + '#' + level] = '^' + pitches[octave - 1](index);
				}
			}
		}
	}
	convert(chords) {
		let result = chords.map(({ notes, time }) => {
			let last = notes.pop();
			let output = `\\${this.mapping[time]}{${this.repr[last.name]}}\\en\\setemptybar\\bar\n`;
			if (notes.length === 0) {
				return "\\Notes" + output;
			}
			return `\\Notes${notes.map(note => `\\${this.notehead[time]}{${this.repr[note.name]}}`).join('')}${output}`;
		}).join('');
		console.log(`\\begin{music}
\\generalmeter{\\meterfrac44}
\\parindent0pt
\\startpiece
\\nobarnumbers
${result}
\\endpiece
\\end{music}`);
	}
}

function parse(midi) {
	parser = new MidiParser(midi);
	document.getElementById("play").removeAttribute("disabled");
	let { meta, tracks } = parser;
	let { ppq, bpm, ts } = meta;
	document.getElementById("header").innerHTML = `ppq: ${ppq} bpm: ${bpm} timeSignature: ${ts}<br>${tracks.length} tracks found.`;
	let tbody = document.querySelector("#track-info tbody");
	let select = document.querySelector("#track-select");
	tbody.innerHTML = "";
	select.innerHTML = `<option value="-1" selected>Select a track</option>`;
	tracks.forEach((track, index) => {
		tbody.innerHTML += `<tr>
			<td>${index}</td>
			<td>${track.name}</td>
			<td>${track.instrument.name}</td>
			<td>${track.instrument.family}</td>
			<td>
				<div class="form-check">
					<input class="form-check-input" type="checkbox" checked="true">
				</div>
			</td>
		</tr>`;
		select.innerHTML += `<option value="${index}">${track.name}</option>`;
	});
}

document.getElementById("midi-upload-button").addEventListener("click", async () => {
	let file = document.getElementById("midi-upload").files[0];
	let currentMidi;
	if (!file) {
		//alert("Please choose a MIDI file to upload!");
		currentMidi = await Midi.fromUrl("static/Sua.mid");
		parse(currentMidi);
		return;
	}
	const reader = new FileReader();
	reader.onload = function(e) {
		currentMidi = new Midi(e.target.result);
		parse(currentMidi);
	}
	reader.readAsArrayBuffer(file);
});

document.getElementById("play").addEventListener("click", event => {
	let target = event.currentTarget;
	if (player && player.playing) {
		player.pause();
		target.innerText = "Play";
	} else {
		let index = parseInt(document.querySelector("#track-select").value, 10);
		if (index === -1) {
			alert("Please select a track to play!");
			return;
		}
		player = new Player(parser.tracks[index].groups, parser.meta);
		player.play();
		target.innerText = "Pause";
	}
	target.classList.toggle("btn-primary");
	target.classList.toggle("btn-danger");
});
