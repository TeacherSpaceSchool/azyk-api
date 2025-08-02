const mongoose = require('mongoose');

const IntegrationLogAzykSchema = mongoose.Schema({
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
   },
    path: String,
    xml: String,
}, {
    timestamps: true
});


const IntegrationLogAzyk = mongoose.model('IntegrationLogAzyk', IntegrationLogAzykSchema);

module.exports = IntegrationLogAzyk;