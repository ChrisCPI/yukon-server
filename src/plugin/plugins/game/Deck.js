import GamePlugin from '@plugin/GamePlugin'

import data from '@data/data'


const starterDeckId = 821
const fireDeckId = 8006

export default class Sensei extends GamePlugin {

    constructor(handler) {
        super(handler)

        this.events = {
            'add_starter_deck': this.addStarterDeck,
            'add_fire_deck': this.addFireDeck
        }
    }

    addStarterDeck(args, user) {
        if (user.inventory.includes(starterDeckId)) {
            return
        }

        this.addDeck(starterDeckId, user)
    }

    addFireDeck(args, user) {
        if (user.ninjaRank < 10) {
            return
        }

        if (user.inventory.includes(fireDeckId)) {
            return
        }

        this.addDeck(fireDeckId, user)
    }

    addDeck(id, user) {
        const deck = data.decks[id]

        for (const card of deck) {
            if (data.cards[card].powerId === 0) {
                user.cards.add(card)
            }
        }

        const powerCards = deck.filter(card => data.cards[card].powerId > 0)

        const randomPowerCard = powerCards[Math.floor(Math.random() * powerCards.length)]

        user.cards.add(randomPowerCard)

        const deckItem = this.crumbs.items[id]

        user.inventory.add(id)
        user.send('add_item', { item: id, name: deckItem.name, slot: 'award', coins: user.coins })
    }

}
