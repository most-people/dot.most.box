import { DotServer } from './DotServer'
import { DotClient } from './DotClient'
import { mostWallet, encode, decode } from './MostWallet'

export type { MostWallet } from './MostWallet'
export type { DotServer, DotData } from './DotServer'
export type { DotClient } from './DotClient'

const Dot = {
    DotServer,
    DotClient,
    mostWallet,
    encode,
    decode,
}

export default Dot
