const ReviewAzyk = require('../models/reviewAzyk');
const ClientAzyk = require('../models/clientAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');
const mongoose = require('mongoose');
const {sendPushToAdmin, unawaited, isNotEmpty, defaultLimit} = require('../module/const');
const {roleList} = require('../module/enum');

const type = `
  type Review {
    _id: ID
    createdAt: Date
    organization: Organization
    client: Client
    taken: Boolean
    type: String
    text: String
 }
`;

const query = `
    reviews(organization: ID, skip: Int, filter: String): [Review]
`;

const mutation = `
    addReview(organization: ID!, text: String!, type: String!): Review
    acceptReview(_id: ID!): String
    deleteReview(_id: ID!): String
`;

const resolvers = {
    reviews: async(parent, {organization, skip, filter}, {user}) => {
        if(['суперорганизация', 'организация', roleList.admin, roleList.client].includes(user.role)) {
            let reviews = await ReviewAzyk.aggregate(
                [
                    {
                        $match: {
                            ...user.organization ? {organization: user.organization} : organization ? {organization: new mongoose.Types.ObjectId(organization)} : {},
                            ...user.client ? {client: user.client} : {}
                       }
                   },
                    {
                        $match: {
                            ...(filter === 'обработка' ? {taken: false} : {})
                       }
                   },
                    {$sort : {'createdAt': -1}},
                    {$skip: isNotEmpty(skip) ? skip : 0},
                    {$limit: isNotEmpty(skip) ? defaultLimit : 10000000000},
                    {
                        $lookup:
                            {
                                from: ClientAzyk.collection.collectionName,
                                let: {client: '$client'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$client', '$_id']}}},
                                ],
                                as: 'client'
                           }
                   },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: false,
                            path: '$client'
                       }
                   },
                    {
                        $lookup:
                            {
                                from: OrganizationAzyk.collection.collectionName,
                                let: {organization: '$organization'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$organization', '$_id']}}},
                                ],
                                as: 'organization'
                           }
                   },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$organization'
                       }
                   }
                ])
            // eslint-disable-next-line no-undef
            await Promise.all(reviews.map(async (review) => {
                if (!review.organization) {
                    const reviewData = await ReviewAzyk.findOne({_id: review._id}).select('organization').lean();
                    if (reviewData && reviewData.organization) {
                        const subBrandData = await SubBrandAzyk.findOne({_id: reviewData.organization}).select('_id name').lean();
                        if (subBrandData) {
                            review.organization = subBrandData;
                       }
                   }
               }
           }));
            return reviews
       }
   }
};

const resolversMutation = {
    addReview: async(parent, {organization, text, type}, {user}) => {
        if(user.role===roleList.client) {
            // eslint-disable-next-line no-undef
            const [createdObject, clientData, organizationData] = await Promise.all([
                ReviewAzyk.create({organization, client: user.client, taken: false, type, text}),
                ClientAzyk.findById(user.client).select('_id name').lean(),
                OrganizationAzyk.findById(organization).select('_id name').lean()
            ]);

            unawaited(() => sendPushToAdmin({message: 'Добавлен отзыв'}))
            return {...createdObject.toObject(), client: clientData, organization: organizationData}
       }
   },
    acceptReview: async(parent, {_id}, {user}) => {
        if(['суперорганизация', 'организация', roleList.admin].includes(user.role)) {
            await ReviewAzyk.updateOne({_id}, {taken: true})
       }
        return 'OK'
   },
    deleteReview: async(parent, {_id}, {user}) => {
        if(user.role===roleList.admin) {
            await ReviewAzyk.deleteOne({_id})
       }
        return 'OK'
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;