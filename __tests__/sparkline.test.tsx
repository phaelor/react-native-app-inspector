import { render } from '@testing-library/react-native';
import { Sparkline } from '../src/ui/Sparkline';

describe('<Sparkline />', () => {
  it('renders one bar per value', () => {
    const { toJSON } = render(<Sparkline values={[10, 20, 30]} color="#fff" />);
    const tree = toJSON() as { children: unknown[] | null };
    expect(tree.children).toHaveLength(3);
  });

  it('renders nothing but the container for an empty series', () => {
    const { toJSON } = render(<Sparkline values={[]} color="#fff" />);
    const tree = toJSON() as { children: unknown[] | null };
    expect(tree.children).toBeNull();
  });

  it('clamps values above `max` to full height', () => {
    const { toJSON } = render(
      <Sparkline values={[50, 200]} color="#fff" height={20} max={100} />,
    );
    const tree = toJSON() as unknown as {
      children: { props: { style: { height: number } } }[];
    };
    const heights = tree.children.map((bar) => bar.props.style.height);
    expect(heights).toEqual([10, 20]);
  });
});
