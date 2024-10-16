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

        this.podium = new Array(this.users).fill(0)
        this.finishPosition = this.users.length

        this.handleNinjaReady = this.handleNinjaReady.bind(this)
        this.handleSpinnerSelect = this.handleSpinnerSelect.bind(this)
        this.handleBoardSelect = this.handleBoardSelect.bind(this)
        this.handlePickCard = this.handlePickCard.bind(this)
        this.handleChooseElement = this.handleChooseElement.bind(this)
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
        user.events.on('ninja_ready', this.handleNinjaReady)
        user.events.on('spinner_select', this.handleSpinnerSelect)
        user.events.on('board_select', this.handleBoardSelect)
        user.events.on('pick_card', this.handlePickCard)
        user.events.on('choose_element', this.handleChooseElement)

        super.addListeners(user)
    }

    removeListeners(user) {
        user.events.off('ninja_ready', this.handleNinjaReady)
        user.events.off('spinner_select', this.handleSpinnerSelect)
        user.events.off('board_select', this.handleBoardSelect)
        user.events.off('pick_card', this.handlePickCard)
        user.events.off('choose_element', this.handleChooseElement)

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

    handleNinjaReady(args, user) {
        if (this.battle.state !== 0) return

        const ninja = this.ninjas[user.id]

        if (ninja.readyForNext) return

        ninja.readyForNext = true

        if (Object.values(this.ninjas).every(n => n.readyForNext === true)) {
            this.nextRound()
            this.sendNextRound()
        }
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
            this.startElementalBattle(element)
            // Todo
        } else if (element === 'c') {
            if (autoPlay) {
                // Todo
            } else {
                this.battle.state = 1
                ninja.send('choose_element')
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

    startElementalBattle(element) {
        this.battle.state = 3
        this.battle.element = element
        this.battle.seats = Object.values(this.ninjas).map(n => this.getNinjaSeat(n))

        this.send('start_battle', { type: element, seats: this.battle.seats })
    }

    handleChooseElement(args, user) {
        if (!hasProps(args, 'element')) return

        if (!['f', 'w', 's'].includes(args.element)) return

        if (this.battle.state !== 1) return

        if (this.getSeat(user) !== this.currentSeat) return

        this.startElementalBattle(args.element)
    }

    handlePickCard(args, user) {
        if (!hasProps(args, 'card')) return

        if (!isNumber(args.card)) return

        if (!this.battle.seats.includes(this.getSeat(user))) return

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

        if (this.battle.seats.every(seat => this.getNinja(seat).pick !== null)) {
            this.judgeBattle()
        }
    }

    chooseOpponent(seat) {
        if (seat !== this.currentSeat) {

        }
    }

    getNinjasOnTile(tile) {
        return Object.values(this.ninjas).filter(ninja => ninja.tile === tile)
    }

    judgeBattle() {
        // Clear timeout
        this.resolveBattle()

        for (let ninja of Object.values(this.ninjas)) {
            if (ninja.energy === 0) {
                this.podium[this.getNinjaSeat(ninja)] = this.finishPosition
                this.finishPosition -= 1
            }
        }

        if (this.finishPosition === 1) {
            const winnerSeat = this.podium.indexOf(0)
            this.podium[winnerSeat] = 1
        }

        const data = this.battle.seats.map(seat => {
            const ninja = this.getNinja(seat)
            return {
                seat: seat,
                card: ninja.pick,
                energy: ninja.energy,
                state: ninja.state,
            }
        })

        for (let ninja of Object.values(this.ninjas)) {
            ninja.send('judge_battle', {
                ninjas: data,
                battleType: this.battle.element,
                positions: this.podium
            })

            ninja.readyForNext = false

            if (ninja.energy === 0 || this.finishPosition === 1) {
                const playerFinish = this.podium[this.getNinjaSeat(ninja)]

                // update progress

                // remove penguin and send game over
            }
        }

        this.battle.state = 0
    }

    resolveBattle() {
        if (this.battle.type === 1) {
            const cardValues = this.battle.seats.map(seat => {
                const ninja = this.getNinja(seat)

                if (ninja.pick.element == this.battle.element) {
                    return ninja.pick.value
                }

                return 0
            })

            const highestValue = Math.max(...cardValues)
            const isTie = cardValues.filter(v => v === highestValue).length >= 2

            for (let seat of this.battle.seats) {
                const ninja = this.getNinja(seat)
                const card = ninja.pick

                if (card.element !== this.battle.element) {
                    ninja.state = 1
                    ninja.energy -= 1
                } else if (isTie && card.value === highestValue) {
                    ninja.state = 2
                } else if (card.value === highestValue) {
                    ninja.state = 3
                } else {
                    ninja.state = 1
                    ninja.energy -= 1
                }
            }
        } else if (this.battle.state === 2) {
            // Todo
        }
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
            ninja.resetTurn()
        }
    }

    sendNextRound() {
        for (let user of this.users) {
            user.send('next_round', {
                ninja: this.currentSeat,
                deck: this.ninjas[user.id].dealCards(),
                spin: {
                    amount: this.spinAmount,
                    cw: this.moveClockwise,
                    ccw: this.moveCounterClockwise
                }
            })
        }
    }

}
