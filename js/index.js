bsCustomFileInput.init();

let currentMidi = null;
let playing = false;
const synths = [];
let parser;

class MidiParser {
	constructor(midi) {
		this.midi = midi;
		let { header, tracks } = this.midi;
		let { tempos, timeSignatures } = header;
		this.meta = {
			ppq: header.ppq,
			bpm: tempos[0].bpm,
			ts : timeSignatures[0].timeSignature
		};
		this.tracks = tracks.map(track => this.getGroups(track));
		this.tracks.forEach(track => {
			track.markov = new Markov(track.groups);
		});
	}
	getDuration(time) {
		// Duration of all supported notes (including dotted notes) relative to sixteenth note
		const available = [1, 2, 3, 4, 6, 8, 12, 16];
		const target = time / this.meta.ppq * 4;
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
		track.groups = groups;
		return track;
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
		let gainNode = this.AudioContext.createGain();
		oscillator.connect(gainNode);
		gainNode.connect(this.AudioContext.destination);
		oscillator.type = "sine";
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
				<label>
					<input type="checkbox" checked="true">
				</label>
			</td>
		</tr>`;
		select.innerHTML += `<option value="${index}">${track.name}</option>`;
	});
}

document.getElementById("midi-upload-button").addEventListener("click", async () => {
	let file = document.getElementById("midi-upload").files[0];
	if (!file) {
		//alert("Please choose a MIDI file to upload!");
		currentMidi = await Midi.fromUrl("/static/Sua.mid");
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
	if (playing) {
		playing = false;
		target.innerText = "Play";
	} else {
		let index = parseInt(document.querySelector("#track-select").value, 10);
		if (index === -1) {
			alert("Please select a track to play!");
			return;
		}
		play(index);
		playing = true;
		target.innerText = "Pause";
	}
	target.classList.toggle("btn-primary");
	target.classList.toggle("btn-danger");
});

async function play(index) {
	let ins = new Instrument();
	console.log(parser.tracks[index].markov.chain);
	console.log(new Instrument().freq);
	for (let note of parser.tracks[index].markov.orig) {
		let [notes, time] = note.split("/");
		notes = notes.replace("(", "").replace(")", "").split(" ");
		time = 2500 / 16 * time;
		await ins.chord(notes, time);
	}
}
