const { gql, ApolloServer,  } = require('apollo-server-express');
const { RedisPubSub } = require('graphql-redis-subscriptions');
const pubsub = new RedisPubSub();
module.exports.pubsub = pubsub;
const AdsAzyk = require('./adsAzyk');
const FileAzyk = require('./fileAzyk');
const DiscountClientAzyk = require('./discountClientAzyk');
const IntegrateOutShoroAzyk = require('./integrateOutShoroAzyk');
const DistributerAzyk = require('./distributerAzyk');
const BlogAzyk = require('./blogAzyk');
const OutXMLAdsAzyk = require('./outXMLAdsAzyk');
const CategoryAzyk = require('./categoryAzyk');
const SubCategoryAzyk = require('./subCategoryAzyk');
const ReturnedAzyk = require('./returnedAzyk');
const OrganizationAzyk = require('./organizationAzyk');
const AgentHistoryGeoAzyk = require('./agentHistoryGeoAzyk');
const ContactAzyk = require('./contactAzyk');
const FaqAzyk = require('./faqAzyk');
const MerchandisingAzyk = require('./merchandisingAzyk');
const ClientAzyk = require('./clientAzyk');
const EmploymentAzyk = require('./employmentAzyk');
const AutoAzyk = require('./autoAzyk');
const ItemAzyk = require('./itemAzyk');
const SubBrand = require('./subBrandAzyk');
const FormAzyk = require('./formAzyk');
const BasketAzyk = require('./basketAzyk');
const OrderAzyk = require('./orderAzyk');
const EquipmentAzyk = require('./equipmentAzyk');
const PassportAzyk = require('./passport');
const RouteAzyk = require('./routeAzyk');
const NotificationStatisticAzyk = require('./notificationStatisticAzyk');
const StatisticAzyk = require('./statistic');
const SubscriberAzyk = require('./subscriberAzyk');
const AgentRouteAzyk = require('./agentRouteAzyk');
const ReceiveDataAzyk = require('./receiveDataAzyk');
const ReviewAzyk = require('./reviewAzyk');
const ConnectionApplicationAzyk = require('./connectionApplicationAzyk');
const LotteryAzyk = require('./lotteryAzyk');
const DistrictAzyk = require('./districtAzyk');
const Integrate1CAzyk = require('./integrate1CAzyk');
const ErrorAzyk = require('./errorAzyk');
const DeliveryDateAzyk = require('./deliveryDateAzyk');
const { verifydeuserGQL } = require('../module/passport');
const { GraphQLScalarType } = require('graphql');
//const logger = require('logger').createLogger('./public/error.log');
const ModelsErrorAzyk = require('../models/errorAzyk');

const typeDefs = gql`
    scalar Date
    type Data {
       data: String
    }
    type Sort {
        name: String
        field: String
    }
    type Filter {
        name: String
        value: String
    }
    type Social {
        url: String
        image: String
    }
    ${DistrictAzyk.type}
    ${ReviewAzyk.type}
    ${ConnectionApplicationAzyk.type}
    ${LotteryAzyk.type}
    ${DeliveryDateAzyk.type}
    ${ErrorAzyk.type}
    ${AgentRouteAzyk.type}
    ${DistributerAzyk.type}
    ${Integrate1CAzyk.type}
    ${AdsAzyk.type}
    ${FileAzyk.type}
    ${DiscountClientAzyk.type}
    ${ReceiveDataAzyk.type}
    ${IntegrateOutShoroAzyk.type}
    ${SubscriberAzyk.type}
    ${NotificationStatisticAzyk.type}
    ${FaqAzyk.type}
    ${MerchandisingAzyk.type}
    ${AutoAzyk.type}
    ${EquipmentAzyk.type}
    ${ClientAzyk.type}
    ${OrganizationAzyk.type}
    ${AgentHistoryGeoAzyk.type}
    ${BlogAzyk.type}
    ${OutXMLAdsAzyk.type}
    ${PassportAzyk.type}
    ${CategoryAzyk.type}
    ${SubCategoryAzyk.type}
    ${ReturnedAzyk.type}
    ${EmploymentAzyk.type}
    ${ItemAzyk.type}
    ${SubBrand.type}
    ${FormAzyk.type}
    ${ContactAzyk.type}
    ${BasketAzyk.type}
    ${OrderAzyk.type}
    ${RouteAzyk.type}
    ${StatisticAzyk.type}
    type Mutation {
        ${Integrate1CAzyk.mutation}
        ${DistrictAzyk.mutation}
        ${ReviewAzyk.mutation}
        ${ConnectionApplicationAzyk.mutation}
        ${LotteryAzyk.mutation}
        ${DeliveryDateAzyk.mutation}
        ${ErrorAzyk.mutation}
        ${AgentRouteAzyk.mutation}
        ${DistributerAzyk.mutation}
        ${AdsAzyk.mutation}
        ${FileAzyk.mutation}
        ${DiscountClientAzyk.mutation}
        ${ReceiveDataAzyk.mutation}
        ${IntegrateOutShoroAzyk.mutation}
        ${SubscriberAzyk.mutation}
        ${NotificationStatisticAzyk.mutation}
        ${FaqAzyk.mutation}
        ${MerchandisingAzyk.mutation}
        ${AutoAzyk.mutation}
        ${EquipmentAzyk.mutation}
        ${ClientAzyk.mutation}
        ${OrganizationAzyk.mutation}
        ${AgentHistoryGeoAzyk.mutation}
        ${CategoryAzyk.mutation}
        ${SubCategoryAzyk.mutation}
        ${ReturnedAzyk.mutation}
        ${BlogAzyk.mutation}
        ${OutXMLAdsAzyk.mutation}
        ${PassportAzyk.mutation}
        ${EmploymentAzyk.mutation}
        ${ItemAzyk.mutation}
        ${SubBrand.mutation}
        ${FormAzyk.mutation}
        ${ContactAzyk.mutation}
        ${BasketAzyk.mutation}
        ${OrderAzyk.mutation}
        ${RouteAzyk.mutation}
        ${StatisticAzyk.mutation}
    }
    type Query {
        ${Integrate1CAzyk.query}
        ${DistrictAzyk.query}
        ${ReviewAzyk.query}
        ${ConnectionApplicationAzyk.query}
        ${LotteryAzyk.query}
        ${DeliveryDateAzyk.query}
        ${ErrorAzyk.query}
        ${AgentRouteAzyk.query}
        ${DistributerAzyk.query}
        ${ClientAzyk.query}
        ${FaqAzyk.query}
        ${MerchandisingAzyk.query}
        ${AutoAzyk.query}
        ${EquipmentAzyk.query}
        ${OrganizationAzyk.query}
        ${AgentHistoryGeoAzyk.query}
        ${AdsAzyk.query}
        ${FileAzyk.query}
        ${DiscountClientAzyk.query}
        ${ReceiveDataAzyk.query}
        ${IntegrateOutShoroAzyk.query}
        ${SubscriberAzyk.query}
        ${NotificationStatisticAzyk.query}
        ${CategoryAzyk.query}
        ${SubCategoryAzyk.query}
        ${ReturnedAzyk.query}
        ${BlogAzyk.query}
        ${OutXMLAdsAzyk.query}
        ${PassportAzyk.query}
        ${EmploymentAzyk.query}
        ${ItemAzyk.query}
        ${SubBrand.query}
        ${FormAzyk.query}
        ${ContactAzyk.query}
        ${BasketAzyk.query}
        ${OrderAzyk.query}
        ${RouteAzyk.query}
        ${StatisticAzyk.query}
    }
    type Subscription {
        ${OrderAzyk.subscription}
        ${ReturnedAzyk.subscription}
    }
`;

const resolvers = {
    Date: new GraphQLScalarType({
        name: 'Date',
        description: 'Date custom scalar type',
        parseValue(value) {
            return new Date(value); // value from the client
        },
        serialize(value) {
            return new Date(value).getTime();
        },
        parseLiteral(ast) {
            if (ast.kind === Kind.INT) {
                return new Date(ast.value)
            }
            return null;
        },
    }),
    Query: {
        ...Integrate1CAzyk.resolvers,
        ...DistrictAzyk.resolvers,
        ...ReviewAzyk.resolvers,
        ...ConnectionApplicationAzyk.resolvers,
        ...LotteryAzyk.resolvers,
        ...DeliveryDateAzyk.resolvers,
        ...ErrorAzyk.resolvers,
        ...AgentRouteAzyk.resolvers,
        ...DistributerAzyk.resolvers,
        ...FaqAzyk.resolvers,
        ...MerchandisingAzyk.resolvers,
        ...AutoAzyk.resolvers,
        ...EquipmentAzyk.resolvers,
        ...ClientAzyk.resolvers,
        ...OrganizationAzyk.resolvers,
        ...AgentHistoryGeoAzyk.resolvers,
        ...BlogAzyk.resolvers,
        ...OutXMLAdsAzyk.resolvers,
        ...AdsAzyk.resolvers,
        ...FileAzyk.resolvers,
        ...DiscountClientAzyk.resolvers,
        ...ReceiveDataAzyk.resolvers,
        ...IntegrateOutShoroAzyk.resolvers,
        ...SubscriberAzyk.resolvers,
        ...NotificationStatisticAzyk.resolvers,
        ...PassportAzyk.resolvers,
        ...CategoryAzyk.resolvers,
        ...EmploymentAzyk.resolvers,
        ...SubCategoryAzyk.resolvers,
        ...ReturnedAzyk.resolvers,
        ...ItemAzyk.resolvers,
        ...SubBrand.resolvers,
        ...FormAzyk.resolvers,
        ...ContactAzyk.resolvers,
        ...BasketAzyk.resolvers,
        ...OrderAzyk.resolvers,
        ...RouteAzyk.resolvers,
        ...StatisticAzyk.resolvers,
    },
    Mutation: {
        ...Integrate1CAzyk.resolversMutation,
        ...AgentRouteAzyk.resolversMutation,
        ...ReviewAzyk.resolversMutation,
        ...ConnectionApplicationAzyk.resolversMutation,
        ...LotteryAzyk.resolversMutation,
        ...DistrictAzyk.resolversMutation,
        ...DeliveryDateAzyk.resolversMutation,
        ...ErrorAzyk.resolversMutation,
        ...DistributerAzyk.resolversMutation,
        ...FaqAzyk.resolversMutation,
        ...MerchandisingAzyk.resolversMutation,
        ...ClientAzyk.resolversMutation,
        ...AutoAzyk.resolversMutation,
        ...EquipmentAzyk.resolversMutation,
        ...OrganizationAzyk.resolversMutation,
        ...AgentHistoryGeoAzyk.resolversMutation,
        ...CategoryAzyk.resolversMutation,
        ...SubCategoryAzyk.resolversMutation,
        ...ReturnedAzyk.resolversMutation,
        ...BlogAzyk.resolversMutation,
        ...OutXMLAdsAzyk.resolversMutation,
        ...AdsAzyk.resolversMutation,
        ...FileAzyk.resolversMutation,
        ...DiscountClientAzyk.resolversMutation,
        ...ReceiveDataAzyk.resolversMutation,
        ...IntegrateOutShoroAzyk.resolversMutation,
        ...SubscriberAzyk.resolversMutation,
        ...NotificationStatisticAzyk.resolversMutation,
        ...EmploymentAzyk.resolversMutation,
        ...PassportAzyk.resolversMutation,
        ...ItemAzyk.resolversMutation,
        ...SubBrand.resolversMutation,
        ...FormAzyk.resolversMutation,
        ...ContactAzyk.resolversMutation,
        ...BasketAzyk.resolversMutation,
        ...OrderAzyk.resolversMutation,
        ...RouteAzyk.resolversMutation,
        ...StatisticAzyk.resolversMutation,
    },
    Subscription: {
        ...OrderAzyk.resolversSubscription,
        ...ReturnedAzyk.resolversSubscription
    }
};

const run = (app)=>{
    const server = new ApolloServer({
        playground: false,
        typeDefs,
        resolvers,
        subscriptions: {
            keepAlive: 1000,
            onConnect: async (connectionParams) => {
                if (connectionParams&&connectionParams.authorization) {
                    let user = await verifydeuserGQL({headers: {authorization: connectionParams.authorization}}, {})
                    return {
                        user: user,
                    }
                }
                else return {
                    user: {}
                }
                //throw new Error('Missing auth token!');
            },
            onDisconnect: (webSocket, context) => {
                // ...
            },
        },
        context: async (ctx) => {
            //console.log(ctx)
            if (ctx.connection) {
                return ctx.connection.context;
            }
            else if(ctx&&ctx.req) {
                let user = await verifydeuserGQL(ctx.req, ctx.res)
                return {req: ctx.req, res: ctx.res, user: user};
            }
        },
        formatError: (err) => {
            console.error(err)

            //logger.info(err.message);
            let _object = new ModelsErrorAzyk({
                err: err.message,
                path: JSON.stringify(err.path)
            });
            ModelsErrorAzyk.create(_object)

            return err;
        }
    })
    server.applyMiddleware({ app, path : '/graphql', cors: false })
    return server
    //server.listen().then(({ url }) => {console.log(`🚀  Server ready at ${url}`);});
}

module.exports.run = run;
