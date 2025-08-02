const mongoose = require('mongoose');

const ReviewAzykSchema = mongoose.Schema({
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
   },
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClientAzyk'
   },
    taken: Boolean,
    type: String,
    text: String
}, {
    timestamps: true
});


const ReviewAzyk = mongoose.model('ReviewAzyk', ReviewAzykSchema);

module.exports = ReviewAzyk;