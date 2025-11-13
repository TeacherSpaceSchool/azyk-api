const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');

const OrganizationAzykSchema = mongoose.Schema({
    name:  {
        type: String,
        required: true,
        unique: true
   },
    image: String,
    address: [String],
    email: [String],
    phone: [String],
    info: String,
    miniInfo: String,
    status: String,
    catalog: String,
    warehouse:  {
        type: String,
        default: ''
   },
    minimumOrder: Number,
    agentHistory: {
        type: Number,
        default: 100
   },
    priotiry: {
        type: Number,
        default: 0
   },
    del: String,
    refusal: {
        type: Boolean,
        default: false
   },
    divideBySubBrand: {
        type: Boolean,
        default: false
   },
    onlyDistrict: {
        type: Boolean,
        default: false
   },
    dateDelivery: {
        type: Boolean,
        default: false
   },
    addedClient: {
        type: Boolean,
        default: false
   },
    unite: {
        type: Boolean,
        default: true
   },
    superagent: {
        type: Boolean,
        default: true
   },
    onlyIntegrate: {
        type: Boolean,
        default: false
   },
    agentSubBrand: {
        type: Boolean,
        default: false
   },
    clientSubBrand: {
        type: Boolean,
        default: false
   },
    pass: {
        type: String,
        default: ''
   },
    requisites: {
        type: String,
        default: ''
   },
    cities: [String],
    autoAcceptAgent: {
        type: Boolean,
        default: false
   },
    autoAcceptNight: {
        type: Boolean,
        default: false
   },
    clientDuplicate: {
        type: Boolean,
        default: false
   },
    calculateStock: {
        type: Boolean,
        default: false
   },
    calculateConsig: {
        type: Boolean,
        default: false
   },
}, {
    timestamps: true
});

OrganizationAzykSchema.plugin(uniqueValidator);

const OrganizationAzyk = mongoose.model('OrganizationAzyk', OrganizationAzykSchema);


module.exports = OrganizationAzyk;