import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import FriendPicker from './FriendPicker';
import { getShortFriendList } from '../../../services/api/friendService';
import { ShortFriend } from '../../../types/api';

jest.mock('../../../services/api/friendService', () => ({
  getShortFriendList: jest.fn(),
}));

const mockedGetShortFriendList = getShortFriendList as jest.MockedFunction<typeof getShortFriendList>;

const friends: ShortFriend[] = [
  { id: 7, name: 'Ada Lovelace' },
  { id: 8, name: 'Grace Hopper' },
];

describe('FriendPicker', () => {
  beforeEach(() => {
    mockedGetShortFriendList.mockReset();
  });

  describe('dropdown variant (single-select, default)', () => {
    it('shows a loading placeholder while the friend list is in flight', () => {
      mockedGetShortFriendList.mockReturnValue(new Promise(() => {})); // never resolves
      render(<FriendPicker value={null} onChange={jest.fn()} />);

      expect(screen.getByRole('combobox')).toBeDisabled();
      expect(screen.getByText('Loading…')).toBeInTheDocument();
    });

    it('renders the fetched friends as options once loaded', async () => {
      mockedGetShortFriendList.mockResolvedValue(friends);
      render(<FriendPicker value={null} onChange={jest.fn()} />);

      await waitFor(() => expect(screen.getByRole('combobox')).not.toBeDisabled());
      expect(screen.getByRole('option', { name: 'Ada Lovelace' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Grace Hopper' })).toBeInTheDocument();
    });

    it('calls onChange with the selected friend id', async () => {
      mockedGetShortFriendList.mockResolvedValue(friends);
      const onChange = jest.fn();
      render(<FriendPicker value={null} onChange={onChange} />);
      await waitFor(() => expect(screen.getByRole('combobox')).not.toBeDisabled());

      fireEvent.change(screen.getByRole('combobox'), { target: { value: '8' } });

      expect(onChange).toHaveBeenCalledWith(8);
    });

    it('shows an error message instead of the select when the fetch fails', async () => {
      mockedGetShortFriendList.mockRejectedValue(new Error('network down'));
      render(<FriendPicker value={null} onChange={jest.fn()} />);

      await screen.findByText('Could not load your friends list.');
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });
  });

  describe('list variant, multi-select', () => {
    it('renders the fetched friends as checkbox rows, checked ones per `value`', async () => {
      mockedGetShortFriendList.mockResolvedValue(friends);
      render(<FriendPicker multiple value={[7]} onChange={jest.fn()} />);

      await screen.findByText('Ada Lovelace');
      const adaRow = screen.getByText('Ada Lovelace').closest('label') as HTMLElement;
      const graceRow = screen.getByText('Grace Hopper').closest('label') as HTMLElement;
      expect(within(adaRow).getByRole('checkbox')).toBeChecked();
      expect(within(graceRow).getByRole('checkbox')).not.toBeChecked();
    });

    it('toggling a row calls onChange with the id added/removed from the current value', async () => {
      mockedGetShortFriendList.mockResolvedValue(friends);
      const onChange = jest.fn();
      render(<FriendPicker multiple value={[7]} onChange={onChange} />);

      await screen.findByText('Grace Hopper');
      const graceRow = screen.getByText('Grace Hopper').closest('label') as HTMLElement;
      fireEvent.click(within(graceRow).getByRole('checkbox'));

      expect(onChange).toHaveBeenCalledWith([7, 8]);
    });

    it('shows an error message instead of the row list when the fetch fails', async () => {
      mockedGetShortFriendList.mockRejectedValue(new Error('network down'));
      render(<FriendPicker multiple value={[]} onChange={jest.fn()} />);

      await screen.findByText('Could not load your friends list.');
    });
  });

  describe('list variant, single-select (search/filter picker)', () => {
    it('filters rows by the search query', async () => {
      mockedGetShortFriendList.mockResolvedValue(friends);
      render(<FriendPicker variant="list" searchable value={null} onChange={jest.fn()} />);

      await screen.findByText('Ada Lovelace');
      fireEvent.change(screen.getByPlaceholderText('Search friends…'), { target: { value: 'grace' } });

      expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
      expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    });

    it('clicking a row selects it, clicking again deselects it', async () => {
      mockedGetShortFriendList.mockResolvedValue(friends);
      const onChange = jest.fn();
      const { rerender } = render(<FriendPicker variant="list" value={null} onChange={onChange} />);

      await screen.findByText('Ada Lovelace');
      fireEvent.click(screen.getByText('Ada Lovelace'));
      expect(onChange).toHaveBeenCalledWith(7);

      rerender(<FriendPicker variant="list" value={7} onChange={onChange} />);
      fireEvent.click(screen.getByText('Ada Lovelace'));
      expect(onChange).toHaveBeenCalledWith(null);
    });
  });
});
