'use strict'
const express = require("express")
const bodyparser = require("body-parser")
const app = express()
const route_map = express.Router()
const axios = require("axios").default
const Sequelize = require("sequelize")

const listen_addr = '127.0.0.1'
const listen_port = '8080'

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'card.db'
})

class BlackJack extends Sequelize.Model {}
BlackJack.init({
    game_id: {
        autoIncrement: true,
        type: Sequelize.INTEGER,
        primaryKey: true
    },
    card_1_suit: { 
        type: Sequelize.STRING(8),
        allowNull: false
    },
    card_1_value: {
        type: Sequelize.STRING(5),
        allowNull: false
    },
    card_2_suit: { 
        type: Sequelize.STRING(8),
        allowNull: false
    },
    card_2_value: {
        type: Sequelize.STRING(5),
        allowNull: false
    },
    card_total: {
        type: Sequelize.INTEGER,
        allowNull: false
    }, 
    winner: {
        type: Sequelize.BOOLEAN,
        allowNull: false
    }
}, {
    sequelize
})

sequelize.sync().then(() => {
    console.log("Database initialization completed successfully")
}).catch(error => {
    console.log("=================================")
    console.log("Database unable to be initialized\Now exiting...")
    console.log("=================================")
    process.exit(1)
})

app.use(bodyparser.json())


function shuffleDecks(numberOfDecks) {
    const url_get = `http://deckofcardsapi.com/api/deck/new/shuffle/?deck_count=${numberOfDecks}`

    return axios.get(url_get)


}

function displayShuffleFailureMessage(res, error) {
    console.log(`Shuffle failure\nError: ${error}`)
    res.status(400).json({
        status: "shuffle failure",
        message: "Unable to shuffle decks of cards at this time",
        reason: error.message
    })
}

function drawCards(deckId, count) {
    const url = `https://deckofcardsapi.com/api/deck/${deckId}/draw/?count=${count}`
    return axios.get(url)
}

function displayDrawCardFailureMessage(res, error) {
    console.log(`Draw card failure\nError: ${error}`)
    res.status(400).json({
        status: "draw card failure",
        message: "Unable to draw cards at this time",
        reason: error.message
    })
}

function calculateHandValue(values) {
    let total = 0

    for (let i = 0; i < values.length; i++) {
        let value = values[i]

        switch (value.toUpperCase()) {
            case "KING":
            case "QUEEN":
            case "JACK":
                total += 10
                break
            case "ACE":
                total += 11
                break
            default:
                total += parseInt(value)
                break
        }
    }

    return total
}

function storeHand(cards) {
    const gameTotal = calculateHandValue([cards[0].value, cards[1].value])
    return BlackJack.create({
        card_1_suit: cards[0].suit,
        card_1_value: cards[0].value,
        card_2_suit: cards[1].suit,
        card_2_value: cards[1].value,
        card_total: gameTotal,
        winner: (gameTotal >= 17) ? true : false
    })
}

function displayStoreHandFailureMessage(res, error) {
    console.log(`Storing hand in database failed\nReason: ${error}`)
    res.status(400).json({
        status: "store hand failure",
        message: "Unable to create game record in database at this time."
    })    
}

function displayGameResults(res, gameData) {
    let message = null
    if (gameData.winner) {
        message = "Winner! You scored 17 or higher."
    } else {
        message = "Loser! You scored below 17."
    }
    res.json({
        message: message, 
        gameResults: gameData
    })
}

route_map.route('/play-hand')
    .get((req, res) => {
        const action_shuffling_cards = 1,
              action_drawing_cards = 2,
              action_storing_results = 3,
              action_displaying_results = 4
        let currentAction = action_shuffling_cards
        let deckId = 0
        let cards = null

        shuffleDecks(1)
            .then(response => {
                currentAction = action_drawing_cards
                deckId = response.data.deck_id
                return drawCards(deckId, 2) 
            }).then(response => {
                currentAction = action_storing_results
                cards = response.data.cards
                return storeHand(cards)
            }).then(gameResult => {
                currentAction = action_displaying_results
                displayGameResults(res, gameResult)
            })
            .catch(error => {
                switch (currentAction) {
                    case action_shuffling_cards:
                        displayShuffleFailureMessage(res, error)
                        break;
                    case action_drawing_cards:
                        displayDrawCardFailureMessage(res, error)
                        break;
                    case action_storing_results:
                        displayStoreHandFailureMessage(res, error)
                        break;
                    case action_displaying_results:
                            break;
                }
                
            })
    })

app.use(route_map)

app.listen(listen_port, listen_addr, () => {
    console.log(`Server started on ${listen_addr}:${listen_port}`)
})
