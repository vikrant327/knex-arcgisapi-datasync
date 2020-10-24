
require('isomorphic-form-data');
require('isomorphic-fetch');
const config = require('config');
const getDatabase = require('./db');
const { UserSession } = require('@esri/arcgis-rest-auth');
const { getLayer, queryFeatures, updateFeatures } = require('@esri/arcgis-rest-feature-layer');
const notes = require('./notes.js');

const QUERY_LIMIT = 10000;

function serialize (obj) {
    const newObject = {};
    Object.keys(obj).forEach(key => {
        const val = obj[key];
        newObject[key] = val;
    });
    return newObject;
}

const logs = [];
function logger () {
    const args = Array.from(arguments);
    const message = args.map(arg => JSON.stringify(arg)).join('\n');
    logs.push(message);
    console.log(message);
}

(async function main () {
    // database connection
    const db = getDatabase(config);
    const { tableName } = config.get('projectsStatus24Hours');

    const rows = await db(tableName)
        .select('*')
        .where(db.raw('1=1'))
        .limit(QUERY_LIMIT)
        .catch(e => {
            console.warn(e);
            return [];
        });

    logger(`Queried ${rows.length} rows.`);

    var projectKeyStatus = {};
    rows.forEach((row) => {
        projectKeyStatus[row.ProjectNumber] = row.Status;
    });
    // arcgis server for a token
    const arcgis = config.get('arcgis');

    const authentication = new UserSession({
        server: arcgis.url,
        username: arcgis.username,
        password: arcgis.password,
        tokenDuration: arcgis.tokenExpires,
    });

    const layerProps = config.get('featureLayer');
    const layerUrl = `${layerProps.url}/FeatureServer/${layerProps.layerId}`;

    const layerData = await getLayer({
        url: layerUrl,
        authentication
    });

    if (layerData.name !== layerProps.layerTitle) {
        throw new Error(`
            Invalid layer. Required layer to update was ${layerProps.layerTitle}.
            Instead, ${layerData.name} was found at endpoint ${layerUrl}`);
    }

    const queryIds = rows.map(row => `'${row.ProjectNumber}'`);
    const where = `projectnumber IN (${queryIds.join(',')})`;

    const featureSet = await queryFeatures({
        url: layerUrl,
        where,
        outFields: '*',
        authentication
    });

    var features = [];
    featureSet.features.forEach((feature) => {
        if (Object.prototype.hasOwnProperty.call(projectKeyStatus, feature.attributes.projectnumber)) {
            feature.attributes.visionstatus = projectKeyStatus[feature.attributes.projectnumber];
            console.log(JSON.stringify(feature));
            features.push(feature);
        }
    });

    if (features.length) {
        logger(`Applying edits with ${features.length} adds`);

        var featureUpdatedStatus = {};
        features.forEach((feature) => {
            featureUpdatedStatus[feature.attributes.projectnumber] = feature.attributes.visionstatus;
        });

        const editResult = await updateFeatures({
            url: layerUrl,
            authentication,
            features: features
        });

        logger(editResult);

        const d = new Date();
        notes.addNote(d.toLocaleDateString(), JSON.stringify(featureUpdatedStatus));

        return { editResult };
    } else {
        return 'No feature found in the project boundary layer that had been updated in vision in last 24 hours';
    }
})().then((result) => {
    logger(result);

    process.exit();
}).catch(e => {
    logger(e);
});
