//const Markov = require("./index.js");

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
			//track.markov = new Markov(track.groups);
			const alltime = track.groups.map(group => group.time);
			const allnote = track.groups.map(group => group.notes[0].name);
			console.log(`notes = ${JSON.stringify(allnote)}\nbeats = ${JSON.stringify(alltime)}`);
		});
	}
	getDuration(time) {
		// Duration of all supported notes (including dotted notes) relative to sixteenth note
		const available = [1, 2, 3, 4, 6, 8, 12, 16];
		const target = time / this.meta.ppq * 4;
		return available.find(i => i >= target) || 16;
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
		console.log(track)
		let groups = [];
		let tmp = [];
		if (track.notes.length) {
			let lastTime = track.notes[0].bars;
			for (let note of track.notes) {
				if (note.bars === lastTime) tmp.push(note);
				else {
					groups.push(this.getGroup(tmp, lastTime));
					lastTime = note.bars;
					tmp = [note];
				}
			}
			groups.push(this.getGroup(tmp, lastTime));
		}
		track.groups = groups;
		return track;
	}
}

module.exports = MidiParser;
