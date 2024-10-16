import BaseInstance from '../BaseInstance'

import Ninja from './ninja/Ninja'

import { hasProps, isInRange, isNumber } from '@utils/validation'

import { between } from '@utils/math'


const defaultTiles = [0, 8, 4, 12]

export default class FireInstance extends BaseInstance {

    constructor(waddle) {
        super(waddle)

        this.id = 997

        this.ninjas = {}

        this.xpPercentageStart = 60

        this.rankSpeed = 1

        this.board = ['b', 's', 'w', 'f', 'c',
            's', 'f', 'w', 'b', 's',
            'w', 'f', 'c', 'w', 's', 'f']

        this.itemAwards = [6025, 4120, 2013, 1086, 3032]

        this.currentSeat = 0

        this.tabId = null

        this.battle = {
            state: 0,
            type: 1,
            element: null,
            seats: []
        }

        this.handleSpinnerSelect = this.handleSpinnerSelect.bind(this)
        this.handleBoardSelect = this.handleBoardSelect.bind(this)
        this.handlePickCard = this.handlePickCard.bind(this)
    }

    init() {
        super.init()

        for (let user of this.users) {
            this.ninjas[user.id] = new Ninja(user, this)
            this.ninjas[user.id].tile = defaultTiles[this.getSeat(user)]
        }

        this.nextRound()
    }

    getNinja(seat) {
        let user = this.users[seat]

        return this.ninjas[user.id]
    }

    getNinjaSeat(ninja) {
        const n = this.ninjas[ninja.user.id]
        return this.getSeat(n.user)
    }

    get currentNinja() {
        return this.getNinja(this.currentSeat)
    }

    addListeners(user) {
        user.events.on('spinner_select', this.handleSpinnerSelect)
        user.events.on('board_select', this.handleBoardSelect)
        user.events.on('pick_card', this.handlePickCard)

        super.addListeners(user)
    }

    removeListeners(user) {
        user.events.off('spinner_select', this.handleSpinnerSelect)
        user.events.off('board_select', this.handleBoardSelect)
        user.events.off('pick_card', this.handlePickCard)

        super.removeListeners(user)
    }

    start() {
        let users = this.users.map(user => {
            const ninja = this.ninjas[user.id]
            return {
                username: user.username,
                color: user.color,
                energy: ninja.energy,
                tile: ninja.tile
            }
        })

        this.send('start_game', { users: users })

        this.sendNextRound()

        super.start()
    }

    handleSpinnerSelect(args, user) {
        if (!hasProps(args, 'tabId')) return

        if (!isNumber(args.tabId)) return

        if (!isInRange(args.tabId, 1, 6)) return

        if (this.getSeat(user) !== this.currentSeat) return

        if (this.currentNinja.hasSelectedSpinner) return

        this.currentNinja.hasSelectedSpinner = true

        this.send('spinner_select', { tabId: args.tabId }, user)
    }

    handleBoardSelect(args, user) {
        if (!hasProps(args, 'spaceId')) return

        if (!isNumber(args.spaceId)) return

        if (this.getSeat(user) !== this.currentSeat) return

        if (!this.currentNinja.hasSelectedSpinner) return

        if (this.battle.state !== 0) return

        const tile = args.spaceId

        if (tile !== this.moveClockwise && tile !== this.moveCounterClockwise) return

        this.selectBoard(tile)
    }

    selectBoard(tile, autoPlay = false) {
        const ninja = this.currentNinja

        if (!autoPlay || this.battle.state === 0) {
            ninja.tile = tile

            this.send('board_select', { ninja: this.currentSeat, tile: tile })

            this.battle.type = 1
        }

        const element = this.board[tile]

        const tileOccupants = this.getNinjasOnTile(tile)

        if (tileOccupants.length > 1) {
            this.battle.state = 2
            this.battle.element = element
            
            if (autoPlay) {
                tileOccupants = tileOccupants.filter(n => n.user.id !== ninja.user.id)
                // Todo
            } else if (tileOccupants.length > 2) {
                // Todo
            } else {
                const opponent = tileOccupants.find(n => n.user.id !== ninja.user.id)
                this.chooseOpponent(this.getNinjaSeat(opponent))
            }
        } else if (['f', 'w', 's'].includes(element)) {
            this.battle.state = 3
            this.battle.element = element
            this.battle.seats = Object.values(this.ninjas).map(n => this.getNinjaSeat(n))

            this.send('start_battle', { type: element, seats: this.battle.seats })
            // Todo
        } else if (element === 'c') {
            if (autoPlay) {
                // Todo
            } else {
                this.battle.state = 1
                // Todo
            }
        } else if (element === 'b') {
            this.battle.element = element
            this.battle.state = 2

            const ninjas = Object.values(this.ninjas).length

            if (autoPlay || ninjas === 2) {
                // Todo
            } else if (ninjas > 2) {
                // Todo
            }
        }
    }

    handlePickCard(args, user) {
        if (!hasProps(args, 'card')) return

        if (!isNumber(args.card)) return

        const ninja = this.ninjas[user.id]

        if (!ninja.isInDealt(args.card) || ninja.pick) return

        const pick = ninja.getPick(args.card)

        if (this.battle.element !== 'b' && pick.element != this.battle.element) {
            if (ninja.hasPlayableCards(this.battle.element)) {
                return
            }
        }

        ninja.pickCard(args.card)

        this.send('opponent_pick_card', { seat: this.getNinjaSeat(ninja) }, user)
    }

    chooseOpponent(seat) {
        if (seat !== this.currentSeat) {

        }
    }

    getNinjasOnTile(tile) {
        return Object.values(this.ninjas).filter(ninja => ninja.tile === tile)
    }

    nextRound() {
        if (this.currentNinja) {
            this.currentNinja.hasSelectedSpinner = false
        }
        const index = this.currentSeat
        let nextNinja = (index + 1 >= Object.keys(this.ninjas).length) ? 0 : index + 1
        this.currentSeat = nextNinja

        this.tabId = null
        this.spinAmount = between(1, 6)

        const ninjaPosition = this.currentNinja.tile
        this.moveClockwise = (ninjaPosition + this.spinAmount) % 16
        this.moveCounterClockwise = (ninjaPosition - this.spinAmount) % 16

        if (this.moveCounterClockwise < 0) {
            this.moveCounterClockwise += 16
        }

        for (let ninja of Object.values(this.ninjas)) {
            ninja.dealCards()
        }
    }

    sendNextRound() {
        for (let user of this.users) {
            user.send('next_round', {
                ninja: this.currentSeat,
                deck: this.ninjas[user.id].dealt,
                spin: {
                    amount: this.spinAmount,
                    cw: this.moveClockwise,
                    ccw: this.moveCounterClockwise
                }
            })
        }
    }

}
