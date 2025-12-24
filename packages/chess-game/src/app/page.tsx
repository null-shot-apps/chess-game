'use client';

import { useEffect, useState, useCallback } from 'react';

// Chess piece types
type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
type PieceColor = 'white' | 'black';

interface Piece {
  type: PieceType;
  color: PieceColor;
  hasMoved?: boolean;
}

type Board = (Piece | null)[][];

interface GameState {
  board: Board;
  currentPlayer: PieceColor;
  whiteTime: number;
  blackTime: number;
  selectedSquare: [number, number] | null;
  gameOver: boolean;
  winner: PieceColor | 'draw' | null;
  lastMoveTime: number;
}

// Unicode chess pieces
const pieceSymbols: Record<PieceColor, Record<PieceType, string>> = {
  white: {
    king: '♔',
    queen: '♕',
    rook: '♖',
    bishop: '♗',
    knight: '♘',
    pawn: '♙'
  },
  black: {
    king: '♚',
    queen: '♛',
    rook: '♜',
    bishop: '♝',
    knight: '♞',
    pawn: '♟'
  }
};

// Initialize chess board
const initializeBoard = (): Board => {
  const board: Board = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Black pieces (row 0 - top of board)
  board[0] = [
    { type: 'rook', color: 'black' },
    { type: 'knight', color: 'black' },
    { type: 'bishop', color: 'black' },
    { type: 'king', color: 'black' },    // King on e8 (column 4)
    { type: 'queen', color: 'black' },   // Queen on d8 (column 3)
    { type: 'bishop', color: 'black' },
    { type: 'knight', color: 'black' },
    { type: 'rook', color: 'black' }
  ];
  board[1] = Array(8).fill(null).map(() => ({ type: 'pawn' as PieceType, color: 'black' as PieceColor }));
  
  // White pieces (row 7 - bottom of board)
  board[6] = Array(8).fill(null).map(() => ({ type: 'pawn' as PieceType, color: 'white' as PieceColor }));
  board[7] = [
    { type: 'rook', color: 'white' },
    { type: 'knight', color: 'white' },
    { type: 'bishop', color: 'white' },
    { type: 'king', color: 'white' },    // King on e1 (column 4)
    { type: 'queen', color: 'white' },   // Queen on d1 (column 3)
    { type: 'bishop', color: 'white' },
    { type: 'knight', color: 'white' },
    { type: 'rook', color: 'white' }
  ];
  
  return board;
};

export default function ChessGame() {
  const [gameState, setGameState] = useState<GameState>(() => {
    // Try to load from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chessGame');
      if (saved) {
        return JSON.parse(saved);
      }
    }
    return {
      board: initializeBoard(),
      currentPlayer: 'white' as PieceColor,
      whiteTime: 600, // 10 minutes in seconds
      blackTime: 600,
      selectedSquare: null,
      gameOver: false,
      winner: null,
      lastMoveTime: Date.now()
    };
  });

  const [draggedPiece, setDraggedPiece] = useState<{ row: number; col: number } | null>(null);
  const [validMoves, setValidMoves] = useState<[number, number][]>([]);

  // Save to localStorage whenever game state changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chessGame', JSON.stringify(gameState));
    }
  }, [gameState]);

  // Timer logic
  useEffect(() => {
    if (gameState.gameOver) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - gameState.lastMoveTime) / 1000);
      
      setGameState(prev => {
        const newState = { ...prev, lastMoveTime: now };
        
        if (prev.currentPlayer === 'white') {
          newState.whiteTime = Math.max(0, prev.whiteTime - elapsed);
          if (newState.whiteTime === 0) {
            newState.gameOver = true;
            newState.winner = 'black';
          }
        } else {
          newState.blackTime = Math.max(0, prev.blackTime - elapsed);
          if (newState.blackTime === 0) {
            newState.gameOver = true;
            newState.winner = 'white';
          }
        }
        
        return newState;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.gameOver, gameState.lastMoveTime, gameState.currentPlayer]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Check if a move is valid
  const isValidMove = useCallback((board: Board, fromRow: number, fromCol: number, toRow: number, toCol: number): boolean => {
    const piece = board[fromRow][fromCol];
    if (!piece) return false;

    const targetPiece = board[toRow][toCol];
    if (targetPiece && targetPiece.color === piece.color) return false;

    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    const absRowDiff = Math.abs(rowDiff);
    const absColDiff = Math.abs(colDiff);

    switch (piece.type) {
      case 'pawn': {
        const direction = piece.color === 'white' ? -1 : 1;
        const startRow = piece.color === 'white' ? 6 : 1;
        
        // Forward move
        if (colDiff === 0 && !targetPiece) {
          if (rowDiff === direction) return true;
          if (fromRow === startRow && rowDiff === 2 * direction && !board[fromRow + direction][fromCol]) return true;
        }
        
        // Capture
        if (absColDiff === 1 && rowDiff === direction && targetPiece) return true;
        return false;
      }
      
      case 'rook':
        if (rowDiff === 0 || colDiff === 0) {
          return isPathClear(board, fromRow, fromCol, toRow, toCol);
        }
        return false;
      
      case 'knight':
        return (absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2);
      
      case 'bishop':
        if (absRowDiff === absColDiff) {
          return isPathClear(board, fromRow, fromCol, toRow, toCol);
        }
        return false;
      
      case 'queen':
        if (rowDiff === 0 || colDiff === 0 || absRowDiff === absColDiff) {
          return isPathClear(board, fromRow, fromCol, toRow, toCol);
        }
        return false;
      
      case 'king':
        return absRowDiff <= 1 && absColDiff <= 1;
      
      default:
        return false;
    }
  }, []);

  // Check if path is clear (for rook, bishop, queen)
  const isPathClear = (board: Board, fromRow: number, fromCol: number, toRow: number, toCol: number): boolean => {
    const rowStep = toRow > fromRow ? 1 : toRow < fromRow ? -1 : 0;
    const colStep = toCol > fromCol ? 1 : toCol < fromCol ? -1 : 0;
    
    let currentRow = fromRow + rowStep;
    let currentCol = fromCol + colStep;
    
    while (currentRow !== toRow || currentCol !== toCol) {
      if (board[currentRow][currentCol]) return false;
      currentRow += rowStep;
      currentCol += colStep;
    }
    
    return true;
  };

  // Get all valid moves for a piece
  const getValidMoves = useCallback((board: Board, row: number, col: number): [number, number][] => {
    const moves: [number, number][] = [];
    const piece = board[row][col];
    
    if (!piece || piece.color !== gameState.currentPlayer) return moves;
    
    for (let toRow = 0; toRow < 8; toRow++) {
      for (let toCol = 0; toCol < 8; toCol++) {
        if (isValidMove(board, row, col, toRow, toCol)) {
          // Check if move doesn't put own king in check
          const testBoard = board.map(r => [...r]);
          testBoard[toRow][toCol] = testBoard[row][col];
          testBoard[row][col] = null;
          
          if (!isKingInCheck(testBoard, piece.color)) {
            moves.push([toRow, toCol]);
          }
        }
      }
    }
    
    return moves;
  }, [gameState.currentPlayer, isValidMove]);

  // Find king position
  const findKing = (board: Board, color: PieceColor): [number, number] | null => {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.type === 'king' && piece.color === color) {
          return [row, col];
        }
      }
    }
    return null;
  };

  // Check if king is in check
  const isKingInCheck = (board: Board, color: PieceColor): boolean => {
    const kingPos = findKing(board, color);
    if (!kingPos) return false;
    
    const [kingRow, kingCol] = kingPos;
    const opponentColor = color === 'white' ? 'black' : 'white';
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === opponentColor) {
          if (isValidMove(board, row, col, kingRow, kingCol)) {
            return true;
          }
        }
      }
    }
    
    return false;
  };

  // Check for checkmate or stalemate
  const checkGameEnd = useCallback((board: Board, color: PieceColor): { gameOver: boolean; winner: PieceColor | 'draw' | null } => {
    let hasValidMove = false;
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === color) {
          const moves = getValidMoves(board, row, col);
          if (moves.length > 0) {
            hasValidMove = true;
            break;
          }
        }
      }
      if (hasValidMove) break;
    }
    
    if (!hasValidMove) {
      const inCheck = isKingInCheck(board, color);
      return {
        gameOver: true,
        winner: inCheck ? (color === 'white' ? 'black' : 'white') : 'draw'
      };
    }
    
    return { gameOver: false, winner: null };
  }, [getValidMoves]);

  // Handle square click
  const handleSquareClick = (row: number, col: number) => {
    if (gameState.gameOver) return;

    const piece = gameState.board[row][col];
    
    if (gameState.selectedSquare) {
      const [selectedRow, selectedCol] = gameState.selectedSquare;
      
      // Try to move
      if (validMoves.some(([r, c]) => r === row && c === col)) {
        makeMove(selectedRow, selectedCol, row, col);
      } else if (piece && piece.color === gameState.currentPlayer) {
        // Select different piece
        setGameState(prev => ({ ...prev, selectedSquare: [row, col] }));
        setValidMoves(getValidMoves(gameState.board, row, col));
      } else {
        // Deselect
        setGameState(prev => ({ ...prev, selectedSquare: null }));
        setValidMoves([]);
      }
    } else if (piece && piece.color === gameState.currentPlayer) {
      // Select piece
      setGameState(prev => ({ ...prev, selectedSquare: [row, col] }));
      setValidMoves(getValidMoves(gameState.board, row, col));
    }
  };

  // Make a move
  const makeMove = (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    const newBoard = gameState.board.map(r => [...r]);
    const piece = newBoard[fromRow][fromCol];
    
    if (!piece) return;
    
    newBoard[toRow][toCol] = { ...piece, hasMoved: true };
    newBoard[fromRow][fromCol] = null;
    
    const nextPlayer = gameState.currentPlayer === 'white' ? 'black' : 'white';
    const endState = checkGameEnd(newBoard, nextPlayer);
    
    setGameState({
      board: newBoard,
      currentPlayer: nextPlayer,
      whiteTime: gameState.whiteTime,
      blackTime: gameState.blackTime,
      selectedSquare: null,
      gameOver: endState.gameOver,
      winner: endState.winner,
      lastMoveTime: Date.now()
    });
    
    setValidMoves([]);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, row: number, col: number) => {
    const piece = gameState.board[row][col];
    if (!piece || piece.color !== gameState.currentPlayer || gameState.gameOver) {
      e.preventDefault();
      return;
    }
    
    setDraggedPiece({ row, col });
    setValidMoves(getValidMoves(gameState.board, row, col));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, toRow: number, toCol: number) => {
    e.preventDefault();
    
    if (!draggedPiece) return;
    
    const { row: fromRow, col: fromCol } = draggedPiece;
    
    if (validMoves.some(([r, c]) => r === toRow && c === toCol)) {
      makeMove(fromRow, fromCol, toRow, toCol);
    }
    
    setDraggedPiece(null);
    setValidMoves([]);
  };

  const handleDragEnd = () => {
    setDraggedPiece(null);
    setValidMoves([]);
  };

  // New game
  const handleNewGame = () => {
    const newState: GameState = {
      board: initializeBoard(),
      currentPlayer: 'white',
      whiteTime: 600,
      blackTime: 600,
      selectedSquare: null,
      gameOver: false,
      winner: null,
      lastMoveTime: Date.now()
    };
    setGameState(newState);
    setValidMoves([]);
    localStorage.setItem('chessGame', JSON.stringify(newState));
  };

  // Resign
  const handleResign = () => {
    setGameState(prev => ({
      ...prev,
      gameOver: true,
      winner: prev.currentPlayer === 'white' ? 'black' : 'white'
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">Chess Game</h1>
          <p className="text-purple-200">Two Player • 10 Minutes Each</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">
          {/* Game Info Panel */}
          <div className="w-full lg:w-64 space-y-4">
            {/* Black Player Timer */}
            <div className={`bg-slate-800/80 rounded-lg p-4 border-2 transition-all ${
              gameState.currentPlayer === 'black' && !gameState.gameOver 
                ? 'border-purple-400 shadow-lg shadow-purple-500/50' 
                : 'border-slate-700 opacity-70'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-white font-semibold text-sm uppercase tracking-wide">Black</span>
                <span className="text-3xl font-mono font-bold text-white">{formatTime(gameState.blackTime)}</span>
              </div>
            </div>

            {/* Game Status */}
            <div className="bg-slate-800/80 rounded-lg p-4 border border-slate-700">
              {gameState.gameOver ? (
                <div className="text-center">
                  <p className="text-xl font-bold text-white mb-2">Game Over!</p>
                  <p className="text-purple-200">
                    {gameState.winner === 'draw' 
                      ? 'Stalemate - Draw!' 
                      : `${gameState.winner === 'white' ? 'White' : 'Black'} Wins!`}
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-purple-200 mb-1">Current Turn</p>
                  <p className="text-xl font-bold text-white capitalize">{gameState.currentPlayer}</p>
                </div>
              )}
            </div>

            {/* White Player Timer */}
            <div className={`bg-slate-800/80 rounded-lg p-4 border-2 transition-all ${
              gameState.currentPlayer === 'white' && !gameState.gameOver 
                ? 'border-purple-400 shadow-lg shadow-purple-500/50' 
                : 'border-slate-700 opacity-70'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-white font-semibold text-sm uppercase tracking-wide">White</span>
                <span className="text-3xl font-mono font-bold text-white">{formatTime(gameState.whiteTime)}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={handleNewGame}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                New Game
              </button>
              <button
                onClick={handleResign}
                disabled={gameState.gameOver}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Resign
              </button>
            </div>
          </div>

          {/* Chess Board */}
          <div className="flex-shrink-0">
            <div className="bg-slate-800/50 p-3 rounded-xl shadow-2xl border border-slate-700">
              <div className="grid grid-cols-8 gap-0 w-full max-w-[640px] aspect-square">
                {gameState.board.map((row, rowIndex) =>
                  row.map((piece, colIndex) => {
                    const isLight = (rowIndex + colIndex) % 2 === 0;
                    const isSelected = gameState.selectedSquare?.[0] === rowIndex && gameState.selectedSquare?.[1] === colIndex;
                    const isValidMoveSquare = validMoves.some(([r, c]) => r === rowIndex && c === colIndex);
                    const isDragging = draggedPiece?.row === rowIndex && draggedPiece?.col === colIndex;
                    
                    return (
                      <div
                        key={`${rowIndex}-${colIndex}`}
                        className={`
                          relative grid place-items-center cursor-pointer select-none
                          ${isLight ? 'bg-[#f0d9b5]' : 'bg-[#b58863]'}
                          ${isSelected ? 'ring-4 ring-inset ring-blue-500' : ''}
                          ${isValidMoveSquare ? 'ring-4 ring-inset ring-green-500' : ''}
                          ${isDragging ? 'opacity-50' : ''}
                          hover:brightness-105 transition-all
                        `}
                        onClick={() => handleSquareClick(rowIndex, colIndex)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, rowIndex, colIndex)}
                      >
                        {piece && (
                          <div
                            draggable={piece.color === gameState.currentPlayer && !gameState.gameOver}
                            onDragStart={(e) => handleDragStart(e, rowIndex, colIndex)}
                            onDragEnd={handleDragEnd}
                            className="text-5xl md:text-6xl lg:text-7xl cursor-move select-none leading-none"
                            style={{ 
                              color: piece.color === 'white' ? '#ffffff' : '#1a1a1a',
                              textShadow: piece.color === 'white' 
                                ? '0 2px 4px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.5)' 
                                : '0 2px 4px rgba(255,255,255,0.6), 0 0 2px rgba(255,255,255,0.4)',
                              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))'
                            }}
                          >
                            {pieceSymbols[piece.color][piece.type]}
                          </div>
                        )}
                        {isValidMoveSquare && !piece && (
                          <div className="absolute w-3 h-3 bg-green-500 rounded-full opacity-60" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 text-center text-purple-200 text-sm">
          <p>Click or drag pieces to move • Game auto-saves to localStorage</p>
        </div>
      </div>
    </div>
  );
}


