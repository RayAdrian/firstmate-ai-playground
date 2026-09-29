import styles from "./pricing.module.css";

const plans = [
  { name: "MVP Sprint", price: "₱150,000", blurb: "Six weeks from idea to a shipped, usable MVP.", cta: "Start a sprint" },
  { name: "Team Extension", price: "₱480,000", blurb: "Two engineers embedded in your team, billed monthly.", cta: "Talk to us" },
  { name: "AI Audit", price: "₱65,000", blurb: "A two-week review of where AI can cut your costs.", cta: "Book an audit" },
];

export default function Page() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Pricing</h1>
      <div className={styles.grid}>
        {plans.map((plan) => (
          <section key={plan.name} className={styles.card}>
            <h2 className={styles.name}>{plan.name}</h2>
            <p className={styles.price}>{plan.price}</p>
            <p className={styles.blurb}>{plan.blurb}</p>
            <button type="button" className={styles.cta}>
              {plan.cta}
            </button>
          </section>
        ))}
      </div>
    </main>
  );
}
