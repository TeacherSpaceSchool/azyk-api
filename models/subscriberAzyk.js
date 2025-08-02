const mongoose = require('mongoose');

const SubscriberAzykSchema = mongoose.Schema({
    endpoint: String,
    keys: mongoose.Schema.Types.Mixed,
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserAzyk'
   },
    number: String,
    status: String,
}, {
    timestamps: true
});

const SubscriberAzyk = mongoose.model('SubscriberAzyk', SubscriberAzykSchema);

module.exports = SubscriberAzyk;