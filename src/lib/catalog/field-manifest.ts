/**
 * Which specifications actually apply to which kind of equipment.
 *
 * A furnace has an AFUE and no SEER2. A line set has neither. Without a
 * manifest the product page renders whatever the research file happens to
 * contain, and a base pad ends up with an empty "HSPF2" row -- which reads to a
 * contractor as a site that does not know what it is selling.
 *
 * The importer validates against this, so an out-of-scope field is rejected at
 * import rather than surfacing on a product page.
 */

export type ResearchFieldKey =
  // Identity
  | "productFamily"
  | "modelVariant"
  | "refrigerant"
  | "refrigerantClass"
  | "fuelType"
  | "discontinued"
  | "successorModel"
  // Capacity and performance
  | "coolingCapacityBtu"
  | "heatingCapacityBtu"
  | "tonnage"
  | "seer"
  | "seer2"
  | "eer"
  | "eer2"
  | "hspf"
  | "hspf2"
  | "cop"
  | "afue"
  | "heatingInputBtu"
  | "heatingOutputBtu"
  // Electrical
  | "voltage"
  | "phase"
  | "frequencyHz"
  | "mca"
  | "mocp"
  | "ratedAmps"
  | "fla"
  // Physical
  | "widthIn"
  | "heightIn"
  | "depthIn"
  | "weightLbs"
  | "soundDb"
  | "cfm"
  | "cabinetWidthIn"
  | "installOrientation"
  // Connections
  | "liquidLineIn"
  | "suctionLineIn"
  | "lineSetLengthFt"
  | "maxLineLengthFt"
  | "maxHeightDifferenceFt"
  | "connectionSizeIn"
  // Operating envelope
  | "minCoolingAmbientF"
  | "maxCoolingAmbientF"
  | "minHeatingAmbientF"
  // Generic / accessory
  | "material"
  | "dimensionsText"
  | "lengthFt"
  | "gaugeOrRating"
  | "temperatureRange"
  | "distanceToSpotRatio"
  | "measurementAccuracy"
  | "emissivityRange"
  | "laserClassification"
  | "laserWavelength"
  | "powerSource"
  | "zones";

const IDENTITY: ResearchFieldKey[] = ["productFamily", "modelVariant", "discontinued", "successorModel"];
const ELECTRICAL: ResearchFieldKey[] = ["voltage", "phase", "frequencyHz", "mca", "mocp", "ratedAmps", "fla"];
const PHYSICAL: ResearchFieldKey[] = ["widthIn", "heightIn", "depthIn", "weightLbs"];
const REFRIGERANT: ResearchFieldKey[] = ["refrigerant", "refrigerantClass"];
const LINE_CONNECTIONS: ResearchFieldKey[] = [
  "liquidLineIn", "suctionLineIn", "maxLineLengthFt", "maxHeightDifferenceFt",
];

/**
 * Product type -> the fields that may be populated for it.
 * Anything absent from this list is rejected by the importer.
 */
export const FIELD_MANIFEST: Record<string, ResearchFieldKey[]> = {
  "Outdoor unit": [
    ...IDENTITY, ...REFRIGERANT, ...ELECTRICAL, ...PHYSICAL, ...LINE_CONNECTIONS,
    "coolingCapacityBtu", "heatingCapacityBtu", "tonnage", "zones",
    "seer", "seer2", "eer", "eer2", "hspf", "hspf2", "cop",
    "soundDb", "cfm", "minCoolingAmbientF", "maxCoolingAmbientF", "minHeatingAmbientF",
  ],
  "Indoor unit": [
    ...IDENTITY, ...REFRIGERANT, ...ELECTRICAL, ...PHYSICAL, ...LINE_CONNECTIONS,
    "coolingCapacityBtu", "heatingCapacityBtu", "tonnage", "zones", "soundDb", "cfm",
  ],
  "Ceiling cassette": [
    ...IDENTITY, ...REFRIGERANT, ...ELECTRICAL, ...PHYSICAL, ...LINE_CONNECTIONS,
    "coolingCapacityBtu", "heatingCapacityBtu", "tonnage", "soundDb", "cfm", "installOrientation",
  ],
  "Air handler": [
    ...IDENTITY, ...REFRIGERANT, ...ELECTRICAL, ...PHYSICAL,
    "coolingCapacityBtu", "heatingCapacityBtu", "tonnage", "cfm",
    "cabinetWidthIn", "installOrientation", "liquidLineIn", "suctionLineIn",
  ],
  "Evaporator coil": [
    ...IDENTITY, ...REFRIGERANT, ...PHYSICAL,
    "coolingCapacityBtu", "tonnage", "cabinetWidthIn", "installOrientation",
    "liquidLineIn", "suctionLineIn",
  ],
  Furnace: [
    ...IDENTITY, ...ELECTRICAL, ...PHYSICAL,
    // Deliberately no SEER2/HSPF2/refrigerant: a furnace has none.
    "fuelType", "afue", "heatingInputBtu", "heatingOutputBtu", "cfm",
    "cabinetWidthIn", "installOrientation",
  ],
  "Cassette panel": [...IDENTITY, ...PHYSICAL, "material", "dimensionsText"],
  Control: [...IDENTITY, "voltage", "material", "dimensionsText", ...PHYSICAL],
  "Infrared thermometer": [
    ...IDENTITY,
    "temperatureRange", "distanceToSpotRatio", "measurementAccuracy",
    "emissivityRange", "laserClassification", "laserWavelength", "powerSource",
  ],
  "Line set": [
    ...IDENTITY, "liquidLineIn", "suctionLineIn", "lineSetLengthFt", "lengthFt",
    "material", "gaugeOrRating", "weightLbs", "dimensionsText",
  ],
  Accessory: [
    ...IDENTITY, "material", "dimensionsText", "lengthFt", "weightLbs",
    "gaugeOrRating", "connectionSizeIn", "voltage", "ratedAmps",
  ],
};

/** Human labels and units for the product page specification table. */
export const FIELD_LABELS: Record<ResearchFieldKey, { label: string; unit?: string }> = {
  productFamily: { label: "Product family" },
  modelVariant: { label: "Configuration" },
  refrigerant: { label: "Refrigerant" },
  refrigerantClass: { label: "Refrigerant safety class" },
  fuelType: { label: "Fuel type" },
  discontinued: { label: "Product status" },
  successorModel: { label: "Successor model" },
  coolingCapacityBtu: { label: "Cooling capacity", unit: "BTU/h" },
  heatingCapacityBtu: { label: "Heating capacity", unit: "BTU/h" },
  tonnage: { label: "Nominal tonnage", unit: "ton" },
  seer: { label: "SEER" },
  seer2: { label: "SEER2" },
  eer: { label: "EER" },
  eer2: { label: "EER2" },
  hspf: { label: "HSPF" },
  hspf2: { label: "HSPF2" },
  cop: { label: "COP" },
  afue: { label: "AFUE", unit: "%" },
  heatingInputBtu: { label: "Heating input", unit: "BTU/h" },
  heatingOutputBtu: { label: "Heating output", unit: "BTU/h" },
  voltage: { label: "Voltage" },
  phase: { label: "Phase" },
  frequencyHz: { label: "Frequency", unit: "Hz" },
  mca: { label: "MCA", unit: "A" },
  mocp: { label: "MOCP", unit: "A" },
  ratedAmps: { label: "Rated amps", unit: "A" },
  fla: { label: "Full load amps", unit: "A" },
  widthIn: { label: "Width", unit: "in" },
  heightIn: { label: "Height", unit: "in" },
  depthIn: { label: "Depth", unit: "in" },
  weightLbs: { label: "Weight", unit: "lb" },
  soundDb: { label: "Sound level", unit: "dB(A)" },
  cfm: { label: "Airflow", unit: "CFM" },
  cabinetWidthIn: { label: "Cabinet width", unit: "in" },
  installOrientation: { label: "Installation orientation" },
  liquidLineIn: { label: "Liquid line", unit: "in" },
  suctionLineIn: { label: "Suction line", unit: "in" },
  lineSetLengthFt: { label: "Line set length", unit: "ft" },
  maxLineLengthFt: { label: "Max line length", unit: "ft" },
  maxHeightDifferenceFt: { label: "Max height difference", unit: "ft" },
  connectionSizeIn: { label: "Connection size", unit: "in" },
  minCoolingAmbientF: { label: "Min cooling ambient", unit: "°F" },
  maxCoolingAmbientF: { label: "Max cooling ambient", unit: "°F" },
  minHeatingAmbientF: { label: "Min heating ambient", unit: "°F" },
  material: { label: "Material" },
  dimensionsText: { label: "Dimensions" },
  lengthFt: { label: "Length", unit: "ft" },
  gaugeOrRating: { label: "Gauge / rating" },
  temperatureRange: { label: "Temperature range" },
  distanceToSpotRatio: { label: "Distance-to-spot ratio" },
  measurementAccuracy: { label: "Measurement accuracy" },
  emissivityRange: { label: "Emissivity" },
  laserClassification: { label: "Laser classification" },
  laserWavelength: { label: "Laser wavelength" },
  powerSource: { label: "Power source" },
  zones: { label: "Zones" },
};

/** Order fields appear in on the product page, grouped for scanning. */
export const FIELD_GROUPS: Array<{ heading: string; fields: ResearchFieldKey[] }> = [
  { heading: "Identity", fields: ["productFamily", "modelVariant", "discontinued", "successorModel"] },
  {
    heading: "Capacity and efficiency",
    fields: ["coolingCapacityBtu", "heatingCapacityBtu", "tonnage", "zones", "seer2", "seer", "eer2", "eer", "hspf2", "hspf", "cop", "afue", "heatingInputBtu", "heatingOutputBtu"],
  },
  { heading: "Fuel and refrigerant", fields: ["fuelType", "refrigerant", "refrigerantClass"] },
  { heading: "Electrical", fields: ["voltage", "phase", "frequencyHz", "mca", "mocp", "ratedAmps", "fla"] },
  {
    heading: "Physical",
    fields: ["widthIn", "heightIn", "depthIn", "cabinetWidthIn", "weightLbs", "soundDb", "cfm", "installOrientation", "material", "dimensionsText", "lengthFt", "gaugeOrRating"],
  },
  {
    heading: "Connections",
    fields: ["liquidLineIn", "suctionLineIn", "lineSetLengthFt", "maxLineLengthFt", "maxHeightDifferenceFt", "connectionSizeIn"],
  },
  { heading: "Operating range", fields: ["minCoolingAmbientF", "maxCoolingAmbientF", "minHeatingAmbientF"] },
  {
    heading: "Measurement",
    fields: ["temperatureRange", "distanceToSpotRatio", "measurementAccuracy", "emissivityRange", "laserClassification", "laserWavelength", "powerSource"],
  },
];

export function fieldsForProductType(productType: string): ResearchFieldKey[] {
  return FIELD_MANIFEST[productType] ?? FIELD_MANIFEST.Accessory;
}

export function isFieldApplicable(productType: string, field: string): boolean {
  return fieldsForProductType(productType).includes(field as ResearchFieldKey);
}
