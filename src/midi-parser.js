//const Markov = require("./index.js");

class MidiParser {
	constructor(midi) {
		this.midi = midi;
		this.available = [1, 2, 3, 4, 6, 8, 12, 16];
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
	getDuration(ticks) {
		// Duration of all supported notes (including dotted notes) relative to sixteenth note
		const target = ticks / this.meta.ppq * 4;
		return this.available.find(i => i >= target) || 16;
	}
	getGroup(tmp, lastTime) {
		const time = this.getDuration(tmp[0].durationTicks);
		const id = `(${tmp.map(note => note.name).join(" ")})/${time}`;
		return {
			notes: tmp,
			start: lastTime,
			id,
			time
		};
	}
	getRest(ticks, lastTime) {
		const time = this.available.find(i => i >= ticks) || 16;
		return {
			notes: [{
				name: ""
			}],
			start: lastTime,
			// TODO: id for rest
			id: `()/${time}`,
			time
		};
	}
	getGroups(track) {
		console.log(track)
		let groups = [];
		let tmp = [];
		if (track.notes.length) {
			let lastTime = track.notes[0].ticks;
			for (let note of track.notes) {
				if (note.ticks === lastTime) tmp.push(note);
				else {
					groups.push(this.getGroup(tmp, lastTime));
					const delta = (note.ticks - lastTime - track.notes[0].durationTicks) / this.meta.ppq * 4;
					// TODO: threshold greater than 0
					if (delta > 0) groups.push(this.getRest(delta, note.ticks - delta));
					lastTime = note.ticks;
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
