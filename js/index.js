bsCustomFileInput.init();

let currentMidi = null;
const synths = [];
let parser;

class MidiParser {
	constructor(midi) {
		this.midi = midi;
		let { header, tracks } = this.midi;
		let { tempos, timeSignatures } = header;
		//let { bpm } = tempos[0];
		//let [beatsPerBar, beatUnit] = timeSignatures[0].timeSignature;
		//let barDuration = 60 / bpm * beatsPerBar;
		//let lastBar = 0;
		this.ppq = header.ppq;
		this.tracks = tracks.map(track => this.getGroups(track));
		this.tracks.forEach(track => {
			track.markov = new Markov(track.groups);
		});
	}
	getDuration(time) {
		// Duration of all supported notes (including dotted notes) relative to sixteenth note
		const available = [1, 2, 3, 4, 6, 8, 12, 16];
		const target = time / this.ppq * 4;
		return available.find(i => i >= target);
	}
	getGroup(tmp, lastTime) {
		let time = this.getDuration(tmp[0].durationTicks);
		let id = `(${tmp.map(note => note.name).join(" ")})/${time}`;
		return {
			notes: tmp,
			start: lastTime,
			id,
			time
		};
	}
	getGroups(track) {
		let lastTime = 0;
		let groups = [];
		let tmp = [];
		for (let note of track.notes) {
			if (note.bars === lastTime) tmp.push(note);
			else {
				groups.push(this.getGroup(tmp, lastTime));
				lastTime = note.bars;
				tmp = [note];
			}
		}
		groups.push(this.getGroup(tmp, lastTime));
		return { groups };
	}
}

class Markov {
	constructor(groups, order) {
		this.orig = groups.map(group => group.id);
		let set = [...new Set(this.orig)];
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
		this.pitch = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
		this.standard = {
			pitch : "A",
			octave: 4,
			freq  : 440
		};
		this.freq = {};
		for (let octave = 1; octave <= 8; octave++) {
			let deltaOctave = octave - this.standard.octave;
			for (let index = 0; index < 12; index++) {
				let offset = index - this.pitch.indexOf(this.standard.pitch);
				this.freq[this.pitch[index] + octave] = this.standard.freq * Math.pow(2, deltaOctave) * Math.pow(2, offset / 12);
			}
		}
		this.AudioContext = new (window.AudioContext || window.webkitAudioContext);
	}
	async note(name, time = 500) {
		let oscillator = this.AudioContext.createOscillator();
		//let gainNode = this.AudioContext.createGain();
		//oscillator.connect(gainNode);
		//gainNode.connect(this.AudioContext.destination);
		oscillator.type = "sine";
		oscillator.frequency.value = this.freq[name];
		//gainNode.gain.setValueAtTime(0, this.AudioContext.currentTime);
		//gainNode.gain.linearRampToValueAtTime(1, this.AudioContext.currentTime + 0.01);
		oscillator.connect(this.AudioContext.destination);
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
	async chord(names, time = 500) {
		return Promise.all(names.map(name => this.note(name, time)));
	}
	async test() {
		await this.note("C4");
		await this.note("E4");
		await this.note("G4");
		await this.chord(["C4", "E4", "G4"]);
	}
}

document.getElementById("midi-upload-button").addEventListener("click", () => {
	let file = document.getElementById("midi-upload").files[0];
	if (!file) {
		alert("Please choose a MIDI file to upload!");
		return;
	}
	const reader = new FileReader();
	reader.onload = function(e) {
		currentMidi = new Midi(e.target.result);
		//document.querySelector("#ResultsText").value = JSON.stringify(midi, undefined, 2);
		//document.querySelector("tone-play-toggle").removeAttribute("disabled");
	}
	reader.readAsArrayBuffer(file);
});

document.getElementById("play").addEventListener("click", async () => {
	let playing = true;
	if (!currentMidi) {
		currentMidi = await Midi.fromUrl("/static/Sua.mid");
	}
	parser = new MidiParser(currentMidi);
	console.log(parser.tracks[2].markov.chain);
	console.log(new Instrument().freq);
	return;
});

async function play(orig) {
	let ins = new Instrument();
	if (orig) {
		for (let note of parser.tracks[2].markov.orig) {
			let [notes, time] = note.split("/");
			notes = notes.replace("(", "").replace(")", "").split(" ");
			time = 2500 / 16 * time;
			await ins.chord(notes, time);
		}
	} else {
		for (let index of parser.tracks[2].markov.chain) {
			let note = parser.tracks[2].markov.set[index];
			let [notes, time] = note.split("/");
			notes = notes.replace("(", "").replace(")", "").split(" ");
			time = 2500 / 16 * time;
			await ins.chord(notes, time);
		}
	}
}
