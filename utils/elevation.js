import polyEncoder from 'google-polyline';
import https from 'https';
import { env } from 'process';

let createBatches = (latlngs) => {
	let latlngBatches = [];

	let currentBatch = [];
	for (let i = 0; i < latlngs.length; i++) {
		if (i !== 0 && i % 512 === 0) {
			latlngBatches.push(currentBatch);
			currentBatch = [];
		}
		currentBatch.push([latlngs[i].lat, latlngs[i].lng]);
	}
	if (currentBatch.length !== 0) {
		latlngBatches.push(currentBatch);
	}

	return latlngBatches;
};

async function fetchElevations(url) {
	return new Promise((resolve, reject) => {
		let data = '';

		https
			.get(url, (res) => {
				res.on('data', (chunk) => {
					data += chunk;
				});
				res.on('end', () => {
					resolve(data);
				});
				res.on('error', () => {
					reject(new Error('Error while requesting the elevation data.'));
				});
			})
			.on('error', () => {
				reject(new Error('Error while requesting the elevation data.'));
			});
	});
}

export default async (latlngs) => {
	let batches = createBatches(latlngs);

	let allElevations = [];

	for (let i = 0; i < batches.length; i++) {
		const batch = batches[i];

		let res = await fetchElevations('https://maps.googleapis.com/maps/api/elevation/json?locations=enc:' + polyEncoder.encode(batch) + '&key=' + process.env.GOOGLE_MAPS_API_KEY);

		let jsonRes = JSON.parse(res);

		if (jsonRes.status === 'OK') {
			jsonRes.results.forEach((el) => {
				allElevations.push(el);
			});
		} else {
			throw new Error(jsonRes.status);
		}
	}

	return allElevations;
};
