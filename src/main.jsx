import { eth, Web3 } from 'web3';
import { useState, useEffect, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import {
	AppBar,
	Box,
	Button,
	CssBaseline,
	Dialog,
	GlobalStyles,
	IconButton,
	InputAdornment,
	LinearProgress,
	List,
	ListItem,
	ListItemIcon,
	MenuItem,
	Stack,
	TextField,
	Toolbar,
	Typography,
} from '@mui/material';

import {
    Add,
    CurrencyExchange,
    Details,
    HistoryOutlined,
    Home,
    Info,
    InfoOutlined,
    NorthEast,
    Payment,
    Receipt,
    Refresh,
    Send,
    SouthWest,
    TransferWithinAStation,
    Visibility,
    VisibilityOff
} from '@mui/icons-material';

import { create } from 'zustand';
import { DataGrid, GridToolbarContainer } from "@mui/x-data-grid";
import { BrowserRouter, createBrowserRouter, Link, Route, RouterProvider, Routes } from "react-router-dom";
import { enqueueSnackbar, SnackbarProvider } from "notistack";

// const web3 = new Web3('ws://localhost:8546'); //local Geth node
const web3 = new Web3('ws://localhost:8546'); //local Geth node
await web3.eth.wallet.load('');

const contractAddress = '0x6F2f91427E410788017503d52A8429a156f4C1bd';
const abi = [
	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "winner",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "player1_value",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "player2_value",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "total_deposit",
				"type": "uint256"
			}
		],
		"name": "GameResult",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "confirm",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "get_players",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "get_round",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "get_values",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "init_game",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			}
		],
		"name": "reveal",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "hash",
				"type": "bytes32"
			}
		],
		"name": "set_hash",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	}
]

const bankerAddress = '0x631a5FBde01BF64b073985f7C1B55BAcE6Cb9094';

const contract = new web3.eth.Contract(abi);

const sig2method = new Map(abi.filter(({ type }) => type === 'function').map((x) => [web3.eth.abi.encodeFunctionSignature(x), x.name]));

const serialize = (a) => '0x' + [...a].map((x) => x.toString(16).padStart(2, '0')).join('');

//Create Account
const useWalletStore = create((set) => ({
	wallet: [...web3.eth.wallet], createAccount: async () => {
		const newAccount = web3.eth.accounts.create();
		web3.eth.wallet.add(newAccount);
		await web3.eth.wallet.save('');
		set({ wallet: [...web3.eth.wallet] });
	}
}))

//Obtain Histry, get block number, traverse all the blocks (in the beginning)
const History = () => {
	const [history, setHistory] = useState([]);
	const [pending, setPending] = useState(false);
	const load = async () => {
		setPending(true);
        const lastBlockNumber = parseInt(history.at(-1)?.blockNumber ?? -1);
        const newHistory = [];
        for (let i = lastBlockNumber + 1; i <= await web3.eth.getBlockNumber(); i++) {
            const block = await web3.eth.getBlock(i);//traverse the blocks
            for (const txHash of block.transactions ?? []) {
                const tx = await web3.eth.getTransaction(txHash);//Obtain the transaction by hash
                const receipt = await web3.eth.getTransactionReceipt(txHash);
                newHistory.unshift({ ...tx, ...receipt, timestamp: block.timestamp });
            }//obtain the transaction
        }
        setHistory((prevHistory) => [...prevHistory, ...newHistory]);//Put together the new history and the old ones
        setPending(false);
    };
    useEffect(() => {
        load()
    }, []);

    //Monitor the chain (creation of new block)
    useEffect(() => {
        let subscription;
        (async () => {
            subscription = await web3.eth.subscribe('newHeads');
            subscription.on('data', async (params) => {
                const block = await web3.eth.getBlock(params.number);	  		
                const newHistory = [];
                for (const txHash of block.transactions ?? []) {
                    const tx = await web3.eth.getTransaction(txHash);
                    const receipt = await web3.eth.getTransactionReceipt(txHash);
                    newHistory.unshift({ ...tx, ...receipt, timestamp: block.timestamp })
                }
                setHistory((prevHistory) => {
                    const history = [...prevHistory];
                    for (const i of newHistory) {
                        if (history.length === 0 || i.blockNumber > history.at(-1).blockNumber) {
                            history.unshift(i);
                        }
                    }
                    return history;
                });
            });
        })();
        return () => {
            subscription?.unsubscribe();
        }
    }, []);

    //Use Interface
    return <Box sx={{
        height: 1000, p: 2,
    }}>
    <DataGrid
        rows={history}
        loading={pending}
        columns={[{
            field: 'transactionHash', headerName: 'Tx Hash', width: 400,
        }, {
            field: 'from', headerName: 'From', width: 400
        }, {
            field: 'to', headerName: 'To', width: 400
        }, {
            field: 'value',
            headerName: 'Value (ETH)',
            width: 200,
            valueGetter: ({ value }) => web3.utils.fromWei(value, 'ether')
        }, {
            field: 'timestamp',
            headerName: 'Time',
            type: 'dateTime',
            valueGetter: ({ value }) => new Date(parseInt(value) * 1000),
            width: 300,
        }, {
            field: 'input', headerName: 'Method', width: 150,
            valueGetter: ({ value }) => {
                if (value !== '0x') {
                    return sig2method.get(value.slice(0, 10));
                }
                return '';
            },
        }, {
            field: 'logs', headerName: 'Log', width: 300,
            valueGetter: ({ value }) => {
                if (value.length) {
                    const {
                        winner, player1_value, player2_value, total_deposit
                    } = web3.eth.abi.decodeLog(abi[1].inputs, value[0].data, value[0].topics);
                    let logm = BigInt(player1_value + player2_value) % 2n == 0n ? 'Player 1 wins' : 'Player 2 wins';
                    // logm += '\n' + winner;
                    return logm;
                }
                return '';
            },
        }]}
        getRowId={(row) => row.transactionHash}
        disableRowSelectionOnClick
    />
    </Box>;
}

const Game = ({me, setPending, setError}) => {
    console.log("72062", web3.utils.fromWei(72062, "ether"));
    console.log("38983", web3.utils.fromWei(38983, "ether"));
    console.log("60931", web3.utils.fromWei(60931, "ether"));
    console.log("29122", web3.utils.fromWei(29122, "ether"));

    const getRandomValue = () => {
        const v = new Uint8Array(32);
        crypto.getRandomValues(v);
        return v;
    }
    const [round, setRound] = useState(0);
    const [players, setPalyers] = useState([]);
    const [values, setValues] = useState([]);
    const [value, setValue] = useState(getRandomValue());
    const [bet, setBet] = useState(2);
    const [betError, setBetError] = useState('')

    const [commited, setCommitted] = useState(false);
    const [revealed, setRevealed] = useState(false);

    useEffect(() => {
        let subscription;
        (async () => {
            subscription = await web3.eth.subscribe('newHeads');
            subscription.on('data', () => {
                contract.methods.get_round().call({
                    to: contractAddress
                }).then((r) => {
                    setRound(r);
                    if (r == 0) {
                        setValue(getRandomValue());
                        setCommitted(false);
                        setRevealed(false);
                    }
                });

                contract.methods.get_players().call({
                    to: contractAddress
                }).then((players) => {
                    setPalyers([players[0], players[1]]);
                });

                contract.methods.get_values().call({
                    to: contractAddress
                }).then((values) => {
                    setValues([values[0], values[1]]);
                });
            });
        })();

        return () => {
            subscription?.unsubscribe();
        }
    }, []);

    const roundTitle = [
        'Start', 
        'Player 1 Committed Value', 
        'Player 2 Committed Value', 
        'Player 2 Revealed Value', 
        'Player 1 Revealed Value', 
        `Game End - Winner is Player ${values[0] && values[1] && BigInt(values[0] + values[1]) % 2n == 0n ? '1' : '2'}`
    ];
    const roundTips = [
        'Join the game by submitting a random number and your bet. (Current player 0/2)', 
        players[0] === me?.address ? 'Waiting for Player 2 to join...' : 'Join the game by submitting a random number and your bet. (Current player 1/2)',
        players[1] === me?.address ? 'Please reveal your value.' : 'Waiting for Player 2 to reveal.',
        players[0] === me?.address ? 'Please reveal your value.' : 'Waiting for Player 1 to reveal.',
        'Waiting for result confirmation...', 'Game Over. Press Reset to play again.'
    ];

    return <>
    {
        me !== undefined && 
        <Stack gap={2} sx={{
            width: 650, marginX: 'auto', marginY: 2, display: 'flex', 
        }}>
            <Typography variant='h5'>CoinFlip: {roundTitle[round]}</Typography>
            <Typography variant='caption' color={'grey'}>Banker Address: {bankerAddress}</Typography>
            {
                players.includes(me?.address) && 
                <Typography variant='p'>You are Player {players[0] == me?.address ? 1 : 2}</Typography>
            }
            {
                players.includes(me?.address) && round >= 4 &&
                <Stack gap={2} sx={{ display: 'flex' }}>
                    <Typography variant='caption' color={'grey'}>
                        Player 1 value: {BigInt(values[0]).toString()}
                    </Typography>
                    <Typography variant='caption' color={'grey'}>
                        Player 2 value: {BigInt(values[1]).toString()}
                    </Typography>
                    
                </Stack>
                
            }
            <Typography>{roundTips[round]}</Typography>
            <Stack gap={2} direction='row'>
                <TextField
                    sx={{ width: 500 }}
                    label='Random Chosen Value'
                    value={serialize(value)}
                ></TextField>
                {/* {
                    (round == 0 || (round == 1 && !players.includes(me?.address))) &&
                    <IconButton 
                        color='primary' 
                        sx={{ height: 'fit-content', marginY: 'auto' }} 
                        onClick={() => {
                            setValue(getRandomValue());
                        }}
                    >
                        <Refresh />
                    </IconButton>
                } */}
            </Stack>
            <TextField
                sx={{ width: 220 }}
                label={commited ? 'Bet' : 'Enter your Bet'}
                value={bet}
                error ={betError.length === 0 ? false : true }
                disabled={commited}
                helperText={betError}
                onChange={(e) => {
                    setBet(e.target.value);
                    setBetError(Number(e.target.value) > 0 ? '' : 'Please enter a valid bet amount.'); 
                }}
            ></TextField>
            <Stack gap={2} direction='row'>
                {
                    round < 2 && 
                    <Button variant="contained" disabled={commited || betError.length > 0} onClick={async () => {
                        setPending(true);
                        const h = new Uint8Array(await crypto.subtle.digest('sha-256', value));
                        try {
                            await web3.eth.sendSignedTransaction((await me.signTransaction({
                                input: contract.methods.set_hash(serialize(h)).encodeABI(),
                                to: contractAddress,
                                from: me.address,
                                gas: 1000000,
                                value: web3.utils.toWei(Number(bet), 'ether'),
                            })).rawTransaction);
                            setCommitted(true);
                        } catch (e) {
                            setError(e.message);
                        }
                        setPending(false);
                    }}
                    >Commit</Button>
                }
                {
                    round >= 2 && round < 4 && 
                    <Button variant="contained" disabled={revealed} onClick={async () => {
                        setPending(true);
                        try {
                            await web3.eth.sendSignedTransaction((await me.signTransaction({
                                input: contract.methods.reveal(serialize(value)).encodeABI(),
                                to: contractAddress,
                                from: me.address,
                                gas: 1000000,
                            })).rawTransaction);
                            setRevealed(true);
                        } catch (e) {
                            setError(e.message);
                        }
                        setPending(false);
                    }}
                    >Reveal</Button>
                }
                {
                    round == 4 && 
                    <Button variant="contained" onClick={async () => {
                        setPending(true);
                        try {
                            await web3.eth.sendSignedTransaction((await me.signTransaction({
                                input: contract.methods.confirm().encodeABI(),
                                to: contractAddress,
                                from: me.address,
                                gas: 1000000,
                            })).rawTransaction);
                        } catch (e) {
                            setError(e.message);
                        }
                        setPending(false);
                    }}
                    >Confirm</Button>
                }
                {
                    (round == 0 || round == 5) && 
                    <Button variant="outlined" onClick={async () => {
                        setPending(true);
                        try {
                            await web3.eth.sendSignedTransaction((await me.signTransaction({
                                input: contract.methods.init_game().encodeABI(),
                                to: contractAddress,
                                from: me.address,
                                gas: 1000000,
                            })).rawTransaction);
                            setValue(getRandomValue());
                        } catch (e) {
                            setError(e.message);
                        }
                        setPending(false);
                        setCommitted(false);
                        setRevealed(false);
                    }}
                    >Restart</Button>
                }
            </Stack>   
        </Stack>
    }
    {
        me === undefined && 
        <Stack gap={2} sx={{
            width: 500, marginX: 'auto', marginY: 2, display: 'flex', 
        }}>
            <Typography variant='h5'>CoinFlip: Please join with an account.</Typography>

        </Stack>
    }
    </>
}

const Index = () => {
    const wallet = useWalletStore((state) => state.wallet);
    const createAccount = useWalletStore((state) =>state.createAccount);// Create account
    const [currentAccount, setCurrentAccount] = useState();
    const [infoOpen, setInfoOpen] = useState(false);
    const [paymentOpen, setPaymentOpen] = useState(false);
    const [showPrivateKey, setShowPrivateKey] = useState(false);
    const me = currentAccount === undefined ? undefined : wallet[currentAccount];
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const [balance, setBalance] = useState(0);
    const [recipientAddress, setRecipientAddress] = useState('');
    const [amount, setAmount] = useState(0);

    useEffect(() => {
        if (currentAccount !== undefined && !pending) {
            web3.eth.getBalance(wallet[currentAccount].address).then(setBalance);
        }
    }, [currentAccount, pending]);

    useEffect(() => {
        if (error) {
        enqueueSnackbar(error, {
            variant: 'error'
        })
        setError('');
        }
    }, [error]);

    return <>{pending && <LinearProgress sx={{ position: 'fixed', top: 0, left: 0, zIndex: 10000, width: '100%' }} />}
    <AppBar color='transparent' position='static'>
        <Toolbar>
        <IconButton color='primary' component={Link} to='/'>
            <Home />
        </IconButton>
        <IconButton color='primary' component={Link} to='/history'>
            <HistoryOutlined />
        </IconButton>
        <Box ml='auto'></Box>
        <TextField
            sx={{
            width: 500 
            }}
            size='small'
            select
            label="Account"
            value={currentAccount ?? ''}
            onChange={e => {
            setCurrentAccount(+e.target.value);
            }}
        >
            {wallet.map((a, i) => <MenuItem key={i} value={i}>{a.address}</MenuItem>)}
        </TextField>
        <IconButton color='primary' onClick={() => {
            createAccount();
        }}>
            <Add />
        </IconButton>
        <IconButton color='primary' disabled={me === undefined} onClick={() => {
            setInfoOpen(true);
        }}>
        <InfoOutlined />
        </IconButton>
        <IconButton color='primary' disabled={me === undefined} onClick={() => {
            setPaymentOpen(true);
        }}>
            <Payment />
        </IconButton>
        </Toolbar>
    </AppBar>
    <Routes>
        <Route path='/' element={<Game me={me} setPending={setPending} setError={setError}/>} />
        <Route path='/history' element={<History />} />
    </Routes>
    <Dialog open={infoOpen} onClose={() => setInfoOpen(false)}>
        <Stack gap={2} sx={{
            width: 500, margin: 2, display: 'flex', flexDirection: 'column',
        }}>
            <TextField
                label='Balance'
                value={web3.utils.fromWei(balance, 'ether')}
                InputProps={{
                    endAdornment: <InputAdornment position="end">
                    ETH
                    </InputAdornment>
                }}
            ></TextField>
            <TextField
                label='Private Key'
                type={showPrivateKey ? 'text' : 'password'} value={me?.privateKey}
                InputProps={{
                    endAdornment: <InputAdornment position="end">
                        <IconButton
                            aria-label="toggle password visibility"
                            onClick={() => setShowPrivateKey((show) => !show)}
                            onMouseDown={(e) => e.preventDefault()}
                            edge="end"
                        >
                        {showPrivateKey ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                </InputAdornment>
                }}
            />
            <TextField
                label='Address'
                value={me?.address}
            />
        </Stack>
    </Dialog>
    <Dialog open={paymentOpen} onClose={() => {
        setPaymentOpen(false);
        setRecipientAddress('');
        setAmount(0);
    }}>
        <Stack gap={2} sx={{
            width: 500, margin: 2, display: 'flex', flexDirection: 'column',
        }}>
            <TextField
                label='From'
                value={me?.address}
            />
            <TextField
                label='To'
                value={recipientAddress}
                onChange={(e) => {
                setRecipientAddress(e.target.value);
                }}
            />
            <TextField
            label='Amount'
            type='number'
            value={amount}
            onChange={(e) => {
                setAmount(+e.target.value);
            }}
            InputProps={{
                endAdornment: <InputAdornment position="end">
                ETH
                </InputAdornment>
            }}
            />
            <Button onClick={async () => { //Transfer money
                setPending(true);
                try {
                    await web3.eth.sendSignedTransaction((await me.signTransaction({
                    to: recipientAddress, from: me.address, gas: 1000000, value: web3.utils.toWei(amount, 'ether'),
                    })).rawTransaction);
                    setPaymentOpen(false);
                    setRecipientAddress('');
                    setAmount(0);
                } catch (e) {
                    setError(e.message);
                }
                setPending(false);
                }}>
                Send
            </Button>
        </Stack>
    </Dialog>
    </>
}

const App = () => {  return <>
    <CssBaseline />
    <SnackbarProvider
        autoHideDuration={5000}
    />
    <BrowserRouter>
        <Index />
    </BrowserRouter>
    </>
}
createRoot(document.getElementById('root')).render(<App />);




