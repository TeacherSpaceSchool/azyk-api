const mongoose = require('mongoose');

const singleOutXMLReturnedSchema = mongoose.Schema({
    data: mongoose.Schema.Types.Mixed,
    guid: String,
    date: Date,
    number: String,
    client: String,
    agent: String,
    inv: Number,
    forwarder: String,
    exc: String,
    returned: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ReturnedAzyk'
   },
    track: {
        type: Number,
        default: 1
   },
    status: String,
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
   }
}, {
    timestamps: true
});


const singleOutXMLReturned = mongoose.model('singleOutXMLReturned', singleOutXMLReturnedSchema);

module.exports = singleOutXMLReturned;