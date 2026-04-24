const { calculateHaversineDistance } = require('./logic');

/**
 * STRATEGIC: Beneficiary Clusterer
 * Groups "Out-of-Zone" records by proximity to provide a manageable resolution UI.
 * 
 * @param {Array} records - Array of Beneficiary documents
 * @param {number} thresholdKm - Proximity threshold for clustering (default 5km)
 * @returns {Array} - Array of clusters { center, count, avgOvershoot, nearestZoneId, records }
 */
const clusterOutOfZoneRecords = (records, thresholdKm = 5) => {
  const outOfZone = records.filter(r => r.zoneAssignment?.status === 'out_of_zone');
  if (!outOfZone.length) return [];

  const clusters = [];

  outOfZone.forEach(record => {
    let assigned = false;
    
    // Attempt to add to existing cluster
    for (const cluster of clusters) {
      const dist = calculateHaversineDistance(
        record.geo.lat, record.geo.lng,
        cluster.lat, cluster.lng
      );

      if (dist <= thresholdKm) {
        cluster.records.push(record);
        // Recalculate centroid
        cluster.lat = (cluster.lat * (cluster.records.length - 1) + record.geo.lat) / cluster.records.length;
        cluster.lng = (cluster.lng * (cluster.records.length - 1) + record.geo.lng) / cluster.records.length;
        cluster.avgOvershoot = (cluster.avgOvershoot * (cluster.records.length - 1) + (record.zoneAssignment.overshootKm || 0)) / cluster.records.length;
        assigned = true;
        break;
      }
    }

    // Create new cluster if not assigned
    if (!assigned) {
      clusters.push({
        lat: record.geo.lat,
        lng: record.geo.lng,
        count: 1,
        avgOvershoot: record.zoneAssignment.overshootKm || 0,
        nearestZoneId: record.zoneAssignment.nearestZoneId,
        records: [record]
      });
    }
  });

  return clusters.map(c => ({
    ...c,
    count: c.records.length,
    id: `cluster-${Math.random().toString(36).substr(2, 9)}`
  }));
};

module.exports = { clusterOutOfZoneRecords };
