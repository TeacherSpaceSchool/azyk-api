const mongoose = require('mongoose');

const AgentHistoryGeoAzykSchema = mongoose.Schema({
    agent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmploymentAzyk'
   },
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClientAzyk'
   },
    geo: String
}, {
    timestamps: true
});


const AgentHistoryGeoAzyk = mongoose.model('AgentHistoryGeoAzyk', AgentHistoryGeoAzykSchema);

module.exports = AgentHistoryGeoAzyk;